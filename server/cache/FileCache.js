import crypto from 'crypto';
import mammoth from 'mammoth';

/**
 * LRU cache for file content extraction
 * Caches DOCX extraction results to avoid repeated mammoth processing
 */
class FileCache {
  constructor(maxSizeMB = 50) {
    this.cache = new Map(); // hash -> { content, timestamp, size, filename }
    this.maxSizeBytes = maxSizeMB * 1024 * 1024;
    this.currentSizeBytes = 0;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get file content from cache or extract it
   * @param {Buffer} buffer - File buffer
   * @param {string} mimetype - File MIME type
   * @param {string} filename - Original filename for logging
   * @returns {Promise<string>} Extracted text content
   */
  async get(buffer, mimetype, filename) {
    const hash = this._getHash(buffer);
    const cacheKey = `${hash}:${mimetype}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.hits++;
      cached.timestamp = Date.now(); // Update LRU timestamp
      console.log(`[FileCache] HIT: ${filename} (${this._getHitRate()} hit rate)`);
      return cached.content;
    }

    // Cache miss - extract content
    this.misses++;
    console.log(`[FileCache] MISS: ${filename} - extracting...`);

    let content;
    if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer });
      content = result.value;
    } else {
      content = buffer.toString('utf8');
    }

    // Add to cache with LRU eviction
    const size = Buffer.byteLength(content, 'utf8');
    this._evictIfNeeded(size);

    this.cache.set(cacheKey, {
      content,
      timestamp: Date.now(),
      size,
      filename
    });
    this.currentSizeBytes += size;

    return content;
  }

  /**
   * Generate SHA-256 hash of buffer
   */
  _getHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Get hit rate as percentage string
   */
  _getHitRate() {
    const total = this.hits + this.misses;
    if (total === 0) return '0%';
    return `${Math.round(this.hits / total * 100)}%`;
  }

  /**
   * Evict oldest entries if needed to make room for new content
   */
  _evictIfNeeded(incomingSize) {
    while (this.currentSizeBytes + incomingSize > this.maxSizeBytes && this.cache.size > 0) {
      // Find oldest entry (LRU)
      let oldestKey = null;
      let oldestTime = Infinity;

      for (const [key, value] of this.cache) {
        if (value.timestamp < oldestTime) {
          oldestTime = value.timestamp;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        const evicted = this.cache.get(oldestKey);
        this.currentSizeBytes -= evicted.size;
        this.cache.delete(oldestKey);
        console.log(`[FileCache] Evicted: ${evicted.filename} (LRU)`);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      entries: this.cache.size,
      sizeMB: (this.currentSizeBytes / 1024 / 1024).toFixed(2),
      hitRate: this._getHitRate(),
      hits: this.hits,
      misses: this.misses
    };
  }

  /**
   * Clear all cached entries
   */
  clear() {
    this.cache.clear();
    this.currentSizeBytes = 0;
    console.log('[FileCache] Cache cleared');
  }
}

// Singleton instance with 50MB cache limit
export const fileCache = new FileCache(50);
