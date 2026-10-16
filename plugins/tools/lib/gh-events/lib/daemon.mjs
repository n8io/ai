// The daemon: holds the WebSocket to GitHub's relay (via `gh webhook forward`),
// receives forwarded events over localhost, and self-terminates once no live
// lease remains. It exists ONLY while a gh-wait is actually waiting.

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { writeFileSync, rmSync, existsSync, mkdirSync, openSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ROOT, LEASES_DIR, EVENTS_FILE, STATE_FILE, LOCK_FILE, LOG_FILE, REPO, PORT, EVENTS, HEARTBEAT_MS, STARTUP_GRACE_MS, IDLE_GRACE_MS } from './paths.mjs';
import { appendEvent, foldEvent, loadState, saveState } from './store.mjs';
import { liveLeases, reapStale } from './leases.mjs';
import { listForwarderHooks, deleteHook as apiDeleteHook } from './hooks.mjs';

function log(msg) {
  try {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    writeFileSync(LOG_FILE, line, { flag: 'a' });
  } catch {}
}

function ensureExtension() {
  try {
    const list = execFileSync('gh', ['extension', 'list'], { encoding: 'utf8' });
    if (/gh-webhook/.test(list)) return;
  } catch {}
  log('installing cli/gh-webhook extension');
  execFileSync('gh', ['extension', 'install', 'cli/gh-webhook'], { stdio: 'ignore' });
}

function listForwarderHookIds() {
  return listForwarderHooks().map((h) => h.id);
}

function deleteHook(id) {
  try {
    apiDeleteHook(id);
    log(`deleted webhook ${id}`);
  } catch {
    // already gone (child cleaned it up) → nothing to do
  }
}

export function runDaemon() {
  mkdirSync(LEASES_DIR, { recursive: true });
  writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, port: PORT, startedAt: Date.now(), repo: REPO }));
  const startedAt = Date.now();
  let emptySince = null;
  let state = loadState(STATE_FILE);
  // Fresh event log per daemon lifetime. Safe: a daemon only starts when no
  // waiter exists, so no one relies on the previous lifetime's events.
  writeFileSync(EVENTS_FILE, '');

  ensureExtension();

  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200); res.end('ok'); return;
    }
    if (req.method === 'POST' && req.url === '/hook') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        try {
          const event = {
            type: req.headers['x-github-event'] || 'unknown',
            delivery: req.headers['x-github-delivery'] || null,
            receivedAt: Date.now(),
            payload: body ? JSON.parse(body) : {},
          };
          appendEvent(EVENTS_FILE, event);
          state = foldEvent(state, event);
          saveState(STATE_FILE, state);
          log(`event ${event.type}/${event.payload?.action ?? '-'}`);
        } catch (err) {
          log(`bad event: ${err.message}`);
        }
        res.writeHead(200); res.end('ok');
      });
      return;
    }
    res.writeHead(404); res.end();
  });

  server.listen(PORT, '127.0.0.1', () => {
    log(`listening on 127.0.0.1:${PORT}, repo ${REPO}`);
    const before = new Set(listForwarderHookIds());
    const args = ['webhook', 'forward', `--repo=${REPO}`, `--events=${EVENTS.join(',')}`, `--url=http://127.0.0.1:${PORT}/hook`];
    const fwd = spawn('gh', args, { stdio: ['ignore', openSync(LOG_FILE, 'a'), openSync(LOG_FILE, 'a')] });
    globalThis.__fwd = fwd;
    fwd.on('exit', (code) => log(`gh webhook forward exited: ${code}`));
    // Learn the exact hook our child just created so we can delete precisely
    // on shutdown if the child's own cleanup ever fails to run.
    let tries = 0;
    const finder = setInterval(() => {
      const now = listForwarderHookIds().filter((id) => !before.has(id));
      if (now.length > 0) { globalThis.__ourHookId = now[0]; clearInterval(finder); log(`tracking webhook ${now[0]}`); }
      else if (++tries >= 8) clearInterval(finder);
    }, 1000);
  });

  let shuttingDown = false;
  function shutdown(reason) {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`shutting down: ${reason}`);
    const finish = () => {
      try { server.close(); } catch {}
      // Fallback: if the child's SIGINT cleanup didn't delete our hook, do it.
      if (globalThis.__ourHookId) deleteHook(globalThis.__ourHookId);
      rmSync(LOCK_FILE, { force: true });
      process.exit(0);
    };
    const fwd = globalThis.__fwd;
    if (fwd && fwd.exitCode == null) {
      // SIGINT is gh-webhook's graceful path: it deletes the GitHub-side hook.
      // Wait for the child to exit (up to 4s) so cleanup actually completes.
      const timer = setTimeout(finish, 4000);
      fwd.on('exit', () => { clearTimeout(timer); finish(); });
      try { fwd.kill('SIGINT'); } catch { clearTimeout(timer); finish(); }
    } else {
      finish();
    }
  }

  const heartbeat = setInterval(() => {
    reapStale(LEASES_DIR);
    const live = liveLeases(LEASES_DIR);
    const now = Date.now();
    if (live.length > 0) { emptySince = null; return; }
    if (now - startedAt < STARTUP_GRACE_MS) return; // let the first waiter register
    if (emptySince == null) { emptySince = now; return; }
    if (now - emptySince >= IDLE_GRACE_MS) { clearInterval(heartbeat); shutdown('no live leases'); }
  }, HEARTBEAT_MS);

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Is a daemon already healthy on the expected port?
export async function daemonHealthy() {
  return new Promise((resolve) => {
    const req = (globalThis.fetch
      ? fetch(`http://127.0.0.1:${PORT}/health`, { signal: AbortSignal.timeout(800) }).then((r) => resolve(r.ok)).catch(() => resolve(false))
      : resolve(false));
    void req;
  });
}

// Ensure a daemon is running; spawn one (detached) if not. Resolves when healthy.
export async function ensureDaemon(daemonEntry) {
  if (await daemonHealthy()) return true;
  if (!existsSync(ROOT)) mkdirSync(ROOT, { recursive: true });
  const out = openSync(LOG_FILE, 'a');
  const child = spawn(process.execPath, [daemonEntry], { detached: true, stdio: ['ignore', out, out] });
  child.unref();
  for (let i = 0; i < 40; i++) { // up to ~6s
    await new Promise((r) => setTimeout(r, 150));
    if (await daemonHealthy()) return true;
  }
  return false;
}
