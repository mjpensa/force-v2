import { describe, it, expect, afterEach } from '@jest/globals';
import { spawn } from 'node:child_process';
import net from 'node:net';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Pins the SIGTERM/SIGINT drain in server.js.
 *
 * The handler used to be `console.log('...closing gracefully'); process.exit(0)` — the
 * message claimed a drain that the code did not perform. app.listen's return value was
 * discarded, so there was no server object to close and nothing to wait on; measured, the
 * process was gone within 500ms of the signal with connections still open.
 *
 * That matters here more than in most apps: Railway restarts on every deploy, generation is
 * fire-and-forget after a 202 (routes/content.js), and a full pipeline is 10-12 sequential
 * model calls against a 20-request/day free tier. Severing a connection mid-pipeline throws
 * away quota that has already been spent.
 *
 * These tests cover what the drain actually promises — in-flight requests are honoured and
 * the process still exits promptly. They deliberately do NOT claim in-flight *generations*
 * survive a restart; sessions are in-process memory and surviving that needs durable
 * session state, which this change does not add.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

let child = null;

/** Boot server.js on `port` and resolve once /api/health answers. */
async function startServer(port) {
  child = spawn('node', ['server.js'], {
    cwd: REPO_ROOT,
    env: { ...process.env, API_KEY: 'test-key-not-used', PORT: String(port), NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const output = [];
  child.stdout.on('data', (d) => output.push(String(d)));
  child.stderr.on('data', (d) => output.push(String(d)));

  const exited = new Promise((resolve) => child.on('exit', (code) => resolve(code)));

  const deadline = Date.now() + 20000;
  for (;;) {
    if (Date.now() > deadline) throw new Error(`server did not become ready:\n${output.join('')}`);
    const ok = await new Promise((resolve) => {
      const req = http.get({ host: '127.0.0.1', port, path: '/api/health' }, (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(1000, () => { req.destroy(); resolve(false); });
    });
    if (ok) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  return { exited, output };
}

afterEach(() => {
  if (child && child.exitCode === null) child.kill('SIGKILL');
  child = null;
});

describe('graceful shutdown', () => {
  it('serves a request that is already in flight when SIGTERM arrives', async () => {
    const port = 3211;
    const { exited, output } = await startServer(port);

    // A genuinely in-flight request: declare a Content-Length, then send only part of the
    // body. express.json() holds the request open waiting for the rest, so this is an
    // active request rather than an idle keep-alive socket (which the drain reaps on
    // purpose). Routing to a nonexistent path keeps the assertion about the connection
    // being honoured, not about any particular handler.
    const body = JSON.stringify({ pad: 'y'.repeat(400) });
    const sock = net.connect(port, '127.0.0.1');
    let response = '';
    let socketError = null;
    sock.on('data', (d) => { response += String(d); });
    sock.on('error', (e) => { socketError = e.code; });
    await new Promise((resolve) => sock.on('connect', resolve));

    sock.write(
      'POST /no-such-route HTTP/1.1\r\nHost: localhost\r\n' +
      `Content-Type: application/json\r\nContent-Length: ${body.length}\r\n\r\n` +
      body.slice(0, 10)
    );
    await new Promise((r) => setTimeout(r, 300));

    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 400));

    sock.write(body.slice(10));           // finish the body only after the signal

    const code = await exited;

    expect(socketError).toBeNull();
    expect(response).toMatch(/^HTTP\/1\.1 \d{3}/);   // a real response, not ECONNRESET
    expect(code).toBe(0);
    expect(output.join('')).toContain('HTTP server closed cleanly');
  }, 30000);

  it('exits promptly rather than waiting out the keep-alive timeout', async () => {
    const port = 3212;
    const { exited } = await startServer(port);

    // An idle keep-alive socket. Reaping these only once at the top of the drain left them
    // to expire on the 5s keep-alive timeout; the repeated reap closes them immediately.
    const agent = new http.Agent({ keepAlive: true });
    await new Promise((resolve, reject) => {
      const req = http.get({ host: '127.0.0.1', port, path: '/api/health', agent }, (res) => {
        res.resume();
        res.on('end', resolve);
      });
      req.on('error', reject);
    });

    const t0 = Date.now();
    child.kill('SIGTERM');
    const code = await exited;
    const elapsed = Date.now() - t0;

    expect(code).toBe(0);
    expect(elapsed).toBeLessThan(3000);   // was ~6.7s with a single reap
    agent.destroy();
  }, 30000);
});
