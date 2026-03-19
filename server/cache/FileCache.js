import crypto from 'crypto';
import mammoth from 'mammoth';

class FileCache {
  constructor(maxSizeMB = 50) {
    this.cache = new Map(); // hash -> { content, timestamp, size, filename }
    this.maxSizeBytes = maxSizeMB * 1024 * 1024;
    this.currentSizeBytes = 0;
    this.hits = 0;
    this.misses = 0;
  }

  async get(buffer, mimetype, filename) {
    const hash = this._getHash(buffer);
    const cacheKey = `${hash}:${mimetype}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.hits++;
      cached.timestamp = Date.now(); // Update LRU timestamp
      console.log(`[FileCache] HIT: ${filename} (${this._getHitRate()} hit rate)`);
      return cached.content;
    }
    this.misses++;
    console.log(`[FileCache] MISS: ${filename} - extracting...`);

    let content;
    if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer });
      content = result.value;
    } else {
      content = buffer.toString('utf8');
    }
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

  _getHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  _getHitRate() {
    const total = this.hits + this.misses;
    if (total === 0) return '0%';
    return `${Math.round(this.hits / total * 100)}%`;
  }

  _evictIfNeeded(incomingSize) {
    while (this.currentSizeBytes + incomingSize > this.maxSizeBytes && this.cache.size > 0) {
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

}
export const fileCache = new FileCache(50);
