import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DiskCache, stableStringify, hashSchema } from '../../server/cache/DiskCache.js';

let tempDir;
let cache;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'diskcache-test-'));
  cache = new DiskCache({ cacheDir: tempDir, ttlMs: 60000, enabled: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('DiskCache', () => {
  describe('get', () => {
    it('returns null on cache miss', async () => {
      const result = await cache.get('nonexistent', { model: 'test' });
      expect(result).toBeNull();
    });
  });

  describe('set and get', () => {
    it('returns cached data after set', async () => {
      const data = { text: 'hello world', score: 42 };
      await cache.set('my prompt', { model: 'test' }, data);
      const result = await cache.get('my prompt', { model: 'test' });
      expect(result).toEqual(data);
    });
  });

  describe('_hashKey', () => {
    it('returns consistent hex string for same input', () => {
      const hash1 = cache._hashKey('prompt', { model: 'a' });
      const hash2 = cache._hashKey('prompt', { model: 'a' });
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns different hashes for different input', () => {
      const hash1 = cache._hashKey('prompt A', { model: 'a' });
      const hash2 = cache._hashKey('prompt B', { model: 'a' });
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('wrap', () => {
    it('calls fn on cache miss and returns result', async () => {
      const fn = jest.fn().mockResolvedValue({ answer: 'computed' });
      const result = await cache.wrap('p', { m: 1 }, fn);
      expect(result).toEqual({ answer: 'computed' });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('returns cached value on hit without calling fn', async () => {
      const data = { answer: 'pre-cached' };
      await cache.set('p', { m: 1 }, data);

      const fn = jest.fn().mockResolvedValue({ answer: 'should not run' });
      const result = await cache.wrap('p', { m: 1 }, fn);
      expect(result).toEqual(data);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('TTL expiration', () => {
    it('returns null after TTL expires', async () => {
      const shortCache = new DiskCache({ cacheDir: tempDir, ttlMs: 1, enabled: true });
      await shortCache.set('p', { m: 1 }, { val: 'ephemeral' });

      // Wait just past TTL
      await new Promise((r) => setTimeout(r, 10));

      const result = await shortCache.get('p', { m: 1 });
      expect(result).toBeNull();
    });
  });

  describe('enabled: false', () => {
    it('get returns null when disabled', async () => {
      const disabled = new DiskCache({ cacheDir: tempDir, ttlMs: 60000, enabled: false });
      // Manually write via an enabled cache, then read via disabled
      await cache.set('p', { m: 1 }, { val: 'data' });
      const result = await disabled.get('p', { m: 1 });
      expect(result).toBeNull();
    });

    it('set is a no-op when disabled', async () => {
      const disabled = new DiskCache({ cacheDir: tempDir, ttlMs: 60000, enabled: false });
      await disabled.set('p', { m: 1 }, { val: 'data' });
      // Reading via enabled cache should find nothing
      const result = await cache.get('p', { m: 1 });
      expect(result).toBeNull();
    });
  });

  describe('directory creation', () => {
    it('creates cache directory if it does not exist', async () => {
      const nestedDir = join(tempDir, 'sub', 'deep');
      const nested = new DiskCache({ cacheDir: nestedDir, ttlMs: 60000, enabled: true });
      await nested.set('p', { m: 1 }, { val: 'ok' });

      const files = await readdir(nestedDir);
      expect(files.length).toBe(1);
      expect(files[0]).toMatch(/\.json$/);
    });
  });

  describe('size cap', () => {
    // maxSizeMB was assigned in the constructor and read nowhere, so the cache had no size
    // bound at all — and raising the TTL from 7 to 90 days extended the window over which it
    // grows by 13x. Eviction deletes spent API quota, so it needs to be exercised, not
    // assumed.
    const bigValue = size => ({ blob: 'x'.repeat(size) });

    async function fillPast(cache, entryBytes, count) {
      for (let i = 0; i < count; i++) {
        await cache.set(`prompt-${i}`, { m: 1 }, bigValue(entryBytes));
        // mtime has 1s granularity on some filesystems; nudge ordering deterministically.
        await new Promise(r => setTimeout(r, 2));
      }
    }

    it('does not evict while under the cap', async () => {
      const c = new DiskCache({ cacheDir: tempDir, ttlMs: 60000, enabled: true, maxSizeMB: 10 });
      await fillPast(c, 1000, DiskCache.PRUNE_INTERVAL + 2);
      await c._pruneToMaxSize();
      const files = await readdir(tempDir);
      expect(files.length).toBe(DiskCache.PRUNE_INTERVAL + 2);
    });

    it('evicts oldest-first until it fits under the cap', async () => {
      // 1 MB cap, ~200KB per entry -> only a few survive.
      const c = new DiskCache({ cacheDir: tempDir, ttlMs: 60000, enabled: true, maxSizeMB: 1 });
      await fillPast(c, 200 * 1024, 10);
      await c._pruneToMaxSize();

      const files = await readdir(tempDir);
      expect(files.length).toBeLessThan(10);
      expect(files.length).toBeGreaterThan(0);

      // The most recently written entry must survive — evicting it would mean discarding the
      // response we just paid for.
      const newest = await c.get('prompt-9', { m: 1 });
      expect(newest).not.toBeNull();
    });

    it('only runs the full scan every PRUNE_INTERVAL writes', async () => {
      const c = new DiskCache({ cacheDir: tempDir, ttlMs: 60000, enabled: true, maxSizeMB: 1 });
      let scans = 0;
      c._pruneToMaxSize = async () => { scans += 1; };

      for (let i = 0; i < DiskCache.PRUNE_INTERVAL - 1; i++) {
        await c.set(`p${i}`, { m: 1 }, { v: i });
      }
      expect(scans).toBe(0);

      await c.set('one-more', { m: 1 }, { v: 'x' });
      expect(scans).toBe(1);
    });

    it('exposes maxSizeBytes derived from maxSizeMB', () => {
      expect(new DiskCache({ cacheDir: tempDir, maxSizeMB: 7 }).maxSizeBytes).toBe(7 * 1024 * 1024);
    });
  });

  describe('default TTL', () => {
    // Regression guard: a 7-day TTL was silently deleting responses that cost API quota
    // and existed nowhere else (.gemini-cache/ is gitignored). Do not lower this without
    // a durable archive in place.
    it('defaults to 90 days', () => {
      const c = new DiskCache({ cacheDir: tempDir });
      expect(c.ttlMs).toBe(90 * 24 * 60 * 60 * 1000);
    });
  });
});

describe('stableStringify', () => {
  it('is independent of key insertion order', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });

  it('sorts keys at every nesting level', () => {
    const x = { outer: { z: 1, a: { n: 2, m: 3 } } };
    const y = { outer: { a: { m: 3, n: 2 }, z: 1 } };
    expect(stableStringify(x)).toBe(stableStringify(y));
  });

  it('preserves array order', () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });

  it('handles null and primitives', () => {
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify(5)).toBe('5');
    expect(stableStringify('s')).toBe('"s"');
  });
});

describe('hashSchema', () => {
  it('returns null for a missing schema', () => {
    expect(hashSchema(undefined)).toBeNull();
    expect(hashSchema(null)).toBeNull();
  });

  it('is stable across key reordering', () => {
    const a = { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] };
    const b = { required: ['x'], properties: { x: { type: 'string' } }, type: 'object' };
    expect(hashSchema(a)).toBe(hashSchema(b));
  });

  // This is the whole point: the cache key previously carried only schema.description, and
  // 8 of the 12 real schemas don't define one — so editing a schema replayed a pre-change
  // response and the change looked like it had no effect.
  it('changes when a schema field changes, even with no description', () => {
    const before = { type: 'object', properties: { x: { type: 'string' } } };
    const after = { type: 'object', properties: { x: { type: 'number' } } };
    expect(hashSchema(before)).not.toBe(hashSchema(after));
  });

  it('changes when a required field is added', () => {
    const before = { type: 'object', properties: { x: { type: 'string' } } };
    const after = { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] };
    expect(hashSchema(before)).not.toBe(hashSchema(after));
  });
});
