import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = join(__dirname, '..', '..', 'tests', 'golden');

/**
 * Write-through archive of live Gemini responses into the golden corpus.
 *
 * Enabled with GEMINI_ARCHIVE=1. Off by default so ordinary runs don't churn the
 * committed corpus.
 *
 * The point is that live quota is scarce (20 requests/day/model on the free tier), so a
 * response should never be paid for twice. .gemini-cache/ is not a substitute: it is
 * gitignored, TTL-expiring, and hash-named, so nothing there survives to become a test
 * fixture. Everything archived here is replayable offline forever.
 *
 * Unlike scripts/build-golden-corpus.mjs — which infers the generator from response shape
 * because cache entries don't record it — this runs at the call site, where contentType is
 * already known. That label is authoritative; no inference needed.
 */

// Archive writes are serialized through this chain. generateAllContent runs two generators
// concurrently (APIQueue cap of 2), and both would otherwise read-modify-write manifest.json
// at the same time and lose an entry.
let queue = Promise.resolve();

function slugify(contentType) {
  return String(contentType)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function write(contentType, prompt, data, capturedAt) {
  const generator = slugify(contentType);
  await mkdir(GOLDEN_DIR, { recursive: true });

  const existing = await readdir(GOLDEN_DIR);
  const taken = existing
    .map(f => new RegExp(`^${generator}-(\\d+)\\.json$`).exec(f))
    .filter(Boolean)
    .map(m => Number(m[1]));
  const n = (taken.length ? Math.max(...taken) : 0) + 1;

  const file = `${generator}-${n}.json`;
  await writeFile(
    join(GOLDEN_DIR, file),
    JSON.stringify({ generator, capturedAt, promptPrefix: String(prompt).slice(0, 50), data }, null, 2)
  );

  let manifest = [];
  try {
    manifest = JSON.parse(await readFile(join(GOLDEN_DIR, 'manifest.json'), 'utf8'));
  } catch {
    // no manifest yet — this is the first archived response
  }
  manifest.push({
    file,
    generator,
    sourceHash: null, // archived live, not recovered from the disk cache
    capturedAt: new Date(capturedAt).toISOString(),
    expiredInCache: false,
    bytes: JSON.stringify(data).length,
  });
  manifest.sort((a, b) => a.generator.localeCompare(b.generator) || a.file.localeCompare(b.file));
  await writeFile(join(GOLDEN_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`[Archive] ${file} (${JSON.stringify(data).length} bytes)`);
}

export function archiveResponse(contentType, prompt, data, now = Date.now()) {
  if (process.env.GEMINI_ARCHIVE !== '1') return queue;
  queue = queue
    .then(() => write(contentType, prompt, data, now))
    .catch(err => {
      // Best-effort: a failed archive must never fail the user's generation.
      console.warn(`[Archive] failed for ${contentType}:`, err.message);
    });
  return queue;
}

/** Test seam — lets a test await outstanding archive writes. */
export function archiveIdle() {
  return queue;
}
