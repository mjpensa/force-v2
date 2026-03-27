import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CACHE_DIR = join(__dirname, '..', '..', '.gemini-cache');

export class DiskCache {
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || DEFAULT_CACHE_DIR;
    this.maxSizeMB = options.maxSizeMB || 200;
    this.ttlMs = options.ttlMs || 7 * 24 * 60 * 60 * 1000; // 7 days
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
    } catch {
      // Silent fail — cache is best-effort
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
