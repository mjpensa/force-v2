import { readFile, writeFile, mkdir, unlink, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CACHE_DIR = join(__dirname, '..', '..', '.gemini-cache');

/**
 * Deterministic JSON stringify — object keys sorted at every level.
 *
 * Used to hash generation schemas into the cache key. Plain JSON.stringify preserves
 * insertion order, so reordering two properties in a schema literal would change the hash
 * and needlessly discard every cached response for that generator.
 */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/** Stable fingerprint of a generation schema, for use in the cache key. */
export function hashSchema(schema) {
  if (!schema) return null;
  return createHash('sha256').update(stableStringify(schema)).digest('hex').slice(0, 16);
}

export class DiskCache {
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || DEFAULT_CACHE_DIR;
    // Enforced by _pruneToMaxSize() after every write. Before that this field was assigned
    // here and read nowhere, so the cache had no size bound at all — and raising the TTL
    // from 7 to 90 days below extended the window over which it grows by 13x.
    this.maxSizeMB = options.maxSizeMB || 200;
    this.maxSizeBytes = this.maxSizeMB * 1024 * 1024;
    // 90 days. Every cached response is API quota already spent, and on the free tier that
    // is 20 requests/day/model. A 7-day TTL was silently deleting paid-for responses that
    // existed nowhere else — 8 of the 17 entries recovered into tests/golden/ were already
    // past it and would have been unlinked by the next cache read.
    this.ttlMs = options.ttlMs || 90 * 24 * 60 * 60 * 1000;
    this.enabled = options.enabled ?? (process.env.GEMINI_DISK_CACHE !== 'false');
    this._initialized = false;
  }

  _hashKey(prompt, config) {
    return createHash('sha256').update(JSON.stringify({ prompt, config })).digest('hex');
  }

  async _ensureDir() {
    if (!this._initialized) {
      await mkdir(this.cacheDir, { recursive: true });
      this._initialized = true;
    }
  }

  async get(prompt, config, options = {}) {
    if (!this.enabled || options.skipCache) return null;
    try {
      await this._ensureDir();
      const hash = this._hashKey(prompt, config);
      const filePath = join(this.cacheDir, `${hash}.json`);
      const raw = await readFile(filePath, 'utf8');
      const entry = JSON.parse(raw);
      if (Date.now() - entry.timestamp > this.ttlMs) {
        await unlink(filePath).catch(() => {});
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  }

  async set(prompt, config, data) {
    if (!this.enabled) return;
    try {
      await this._ensureDir();
      const hash = this._hashKey(prompt, config);
      const entry = { timestamp: Date.now(), prompt: String(prompt).slice(0, 50), data };
      await writeFile(join(this.cacheDir, `${hash}.json`), JSON.stringify(entry));
      await this._pruneToMaxSize();
    } catch {
      // Silent fail — cache is best-effort
    }
  }

  /**
   * Drop oldest entries until the cache fits under maxSizeBytes.
   *
   * Eviction is logged rather than silent: every entry here is API quota already spent, and
   * on the free tier that is 20 requests/day. If this starts firing, the right response is
   * to raise the cap or archive with GEMINI_ARCHIVE=1 — not to let it quietly churn.
   */
  async _pruneToMaxSize() {
    const names = (await readdir(this.cacheDir)).filter(n => n.endsWith('.json'));
    const entries = [];
    let total = 0;
    for (const name of names) {
      const path = join(this.cacheDir, name);
      try {
        const s = await stat(path);
        entries.push({ path, name, size: s.size, mtimeMs: s.mtimeMs });
        total += s.size;
      } catch {
        // raced with another writer; skip
      }
    }
    if (total <= this.maxSizeBytes) return;

    entries.sort((a, b) => a.mtimeMs - b.mtimeMs); // oldest first
    for (const e of entries) {
      if (total <= this.maxSizeBytes) break;
      await unlink(e.path).catch(() => {});
      total -= e.size;
      console.warn(
        `[DiskCache] Evicted ${e.name} (${(e.size / 1024).toFixed(0)} KB) — over ${this.maxSizeMB} MB cap. This was spent quota.`
      );
    }
  }

  async wrap(prompt, config, fn, options = {}) {
    const cached = await this.get(prompt, config, options);
    if (cached) return cached;
    const result = await fn();
    await this.set(prompt, config, result);
    return result;
  }
}

export const diskCache = new DiskCache();
