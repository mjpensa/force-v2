import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DiskCache } from '../../server/cache/DiskCache.js';

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
});
