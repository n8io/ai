// Command dispatch for the `gh-events` / `gh-wait` executables.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LEASES_DIR, EVENTS_FILE, STATE_FILE, LOCK_FILE, REPO, PORT, ROOT, WAIT_POLL_MS } from './paths.mjs';
import { evaluateSince, seedVerdict, normalizeSnapshot } from './match.mjs';
import { readEvents, loadState } from './store.mjs';
import { writeLease, removeLease, readLeases, liveLeases, reapStale, defaultIsAlive } from './leases.mjs';
import { ensureDaemon, daemonHealthy } from './daemon.mjs';
import { listForwarderHooks, deleteHook } from './hooks.mjs';

const DAEMON_ENTRY = join(dirname(fileURLToPath(import.meta.url)), 'daemon-entry.mjs');

function parseFlags(argv) {
  const f = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { f[key] = next; i++; } else { f[key] = true; }
    }
  }
  return f;
}

function out(obj) { process.stdout.write(`${JSON.stringify(obj)}\n`); }

// REST-only (`gh api` → core bucket) so seeding works even when the GraphQL
// bucket is exhausted — which is exactly when this tool earns its keep.
function ghApi(path) {
  return JSON.parse(execFileSync('gh', ['api', path], { encoding: 'utf8' }));
}

function ghPrSnapshot(pr, kind) {
  const pull = ghApi(`repos/${REPO}/pulls/${pr}`);
  const sha = pull.head?.sha;
  let checkRuns = [];
  let combinedStatus = { state: 'pending', statuses: [] };
  let reviews = [];
  if (kind === 'ci' && sha) {
    checkRuns = ghApi(`repos/${REPO}/commits/${sha}/check-runs`).check_runs ?? [];
    combinedStatus = ghApi(`repos/${REPO}/commits/${sha}/status`);
  }
  if (kind === 'review') {
    reviews = ghApi(`repos/${REPO}/pulls/${pr}/reviews`);
  }
  return normalizeSnapshot({ pull, checkRuns, combinedStatus, reviews });
}

async function cmdWait(argv) {
  const f = parseFlags(argv);
  const pr = Number(f.pr);
  const kind = f.for || 'ci';
  const timeoutMs = Number(f.timeout || 1800) * 1000;
  if (!pr || !['ci', 'review', 'mergeable', 'any'].includes(kind)) {
    out({ error: 'usage: gh-wait --pr <N> --for ci|review|mergeable|any [--timeout <seconds>]' });
    process.exit(2);
  }

  // Watermark captured BEFORE the seed so any event arriving during/after
  // seeding is in-window, while older log entries are ignored.
  const since = Date.now();

  // 1) One authoritative snapshot — closes the race and short-circuits if done.
  let snapshot;
  try {
    snapshot = ghPrSnapshot(pr, kind);
  } catch (err) {
    out({ satisfied: false, error: `REST seed failed: ${err.message}`, pr, kind });
    process.exit(4);
  }
  const seed = { headSha: snapshot.headRefOid, headBranch: snapshot.headRefName };
  const seeded = seedVerdict(snapshot, kind);
  if (seeded.satisfied) {
    out({ satisfied: true, pr, kind, reason: seeded.reason, detail: seeded.detail, source: 'seed' });
    return;
  }

  // 2) Must wait — register a lease so the daemon knows we exist, then tail.
  mkdirSync(LEASES_DIR, { recursive: true });
  writeLease(LEASES_DIR, { pid: process.pid, pr, kind, startedAt: Date.now() });
  const cleanup = () => removeLease(LEASES_DIR, process.pid);
  process.on('exit', cleanup);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { cleanup(); process.exit(130); });

  const ok = await ensureDaemon(DAEMON_ENTRY);
  if (!ok) { out({ satisfied: false, error: 'daemon failed to start', pr, kind }); process.exit(5); }

  const startedAt = Date.now();
  return new Promise((resolve) => {
    const tick = setInterval(() => {
      const events = readEvents(EVENTS_FILE);
      const verdict = evaluateSince({ events, since, condition: { pr, kind }, seed });
      if (verdict.satisfied) {
        clearInterval(tick);
        out({ satisfied: true, pr, kind, reason: verdict.reason, detail: verdict.detail, source: 'event' });
        resolve();
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(tick);
        out({ satisfied: false, timedOut: true, pr, kind, waitedMs: Date.now() - startedAt });
        process.exitCode = 3;
        resolve();
      }
    }, WAIT_POLL_MS);
  });
}

function readLock() {
  if (!existsSync(LOCK_FILE)) return null;
  try { return JSON.parse(readFileSync(LOCK_FILE, 'utf8')); } catch { return null; }
}

function fmtAge(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m${String(s % 60).padStart(2, '0')}s`;
}

async function cmdPs(argv) {
  const f = parseFlags(argv);
  reapStale(LEASES_DIR); // census also self-heals stale leases
  const lock = readLock();
  const daemonAlive = lock ? defaultIsAlive(lock.pid) : false;
  const healthy = await daemonHealthy();
  const leases = readLeases(LEASES_DIR).map((l) => ({ ...l, alive: defaultIsAlive(l.pid) }));
  if (f.json) { out({ daemon: lock ? { ...lock, alive: daemonAlive, healthy } : null, leases }); return; }

  if (!lock || !daemonAlive) {
    process.stdout.write('daemon:  not running\n');
  } else {
    process.stdout.write(`daemon:  ${healthy ? 'running' : 'stale-lock'}  pid ${lock.pid}  port ${lock.port}  up ${fmtAge(Date.now() - lock.startedAt)}  repo ${lock.repo}\n`);
  }
  if (leases.length === 0) {
    process.stdout.write('leases:  none\n');
  } else {
    for (const l of leases) {
      process.stdout.write(`leases:  pid ${l.pid}  PR #${l.pr}  for=${l.kind}  waiting ${fmtAge(Date.now() - l.startedAt)}${l.alive ? '' : '  [DEAD — run reap]'}\n`);
    }
  }
  // Opt-in leak check (1 REST call): flag forwarder hooks lingering with no daemon.
  if (f.hooks) {
    const hooks = listForwarderHooks();
    if (hooks.length === 0) process.stdout.write('hooks:   none\n');
    else if (!daemonAlive) process.stdout.write(`hooks:   ${hooks.length} forwarder hook(s) with NO daemon — leak; run 'gh-events sweep'\n`);
    else process.stdout.write(`hooks:   ${hooks.length} forwarder hook(s) (daemon active)\n`);
  }
}

function cmdSweep() {
  const hooks = listForwarderHooks();
  const lock = readLock();
  if (lock && defaultIsAlive(lock.pid)) {
    process.stdout.write(`refusing to sweep: daemon pid ${lock.pid} is running (stop it first)\n`);
    process.exitCode = 1;
    return;
  }
  if (hooks.length === 0) { process.stdout.write('no forwarder hooks to sweep\n'); return; }
  let n = 0;
  for (const h of hooks) {
    try { deleteHook(h.id); n++; } catch (err) { process.stdout.write(`could not delete hook ${h.id}: ${err.message}\n`); }
  }
  process.stdout.write(`swept ${n} forwarder hook(s)\n`);
}

function cmdStatus(argv) {
  const f = parseFlags(argv);
  const state = loadState(STATE_FILE);
  if (f.json) { out(f.pr ? { pr: Number(f.pr), byPr: state.byPr[String(f.pr)] ?? null } : state); return; }
  if (f.pr) {
    const s = state.byPr[String(f.pr)];
    process.stdout.write(s ? `PR #${f.pr}: last ${s.lastType}/${s.lastAction}\n` : `PR #${f.pr}: no events seen\n`);
    return;
  }
  process.stdout.write(`events seen: ${state.total}\n`);
  for (const [pr, s] of Object.entries(state.byPr)) {
    process.stdout.write(`  PR #${pr}: last ${s.lastType}/${s.lastAction}\n`);
  }
}

function cmdStop() {
  const lock = readLock();
  if (!lock || !defaultIsAlive(lock.pid)) { process.stdout.write('daemon: not running\n'); return; }
  const live = liveLeases(LEASES_DIR);
  if (live.length > 0) process.stdout.write(`warning: ${live.length} live lease(s) still waiting — stopping anyway\n`);
  try { process.kill(lock.pid, 'SIGTERM'); process.stdout.write(`stopped daemon pid ${lock.pid}\n`); } catch (err) { process.stdout.write(`could not stop: ${err.message}\n`); }
}

function cmdReap() {
  const reaped = reapStale(LEASES_DIR);
  process.stdout.write(reaped.length ? `reaped ${reaped.length} stale lease(s): ${reaped.map((l) => l.pid).join(', ')}\n` : 'no stale leases\n');
}

async function cmdStart() {
  mkdirSync(ROOT, { recursive: true });
  const ok = await ensureDaemon(DAEMON_ENTRY);
  process.stdout.write(ok ? `daemon running on port ${PORT}\n` : 'daemon failed to start\n');
  if (!ok) process.exitCode = 1;
}

function requireRepo() {
  if (REPO) return;
  out({ error: 'no repo: run inside a GitHub checkout or set GH_EVENTS_REPO=owner/name' });
  process.exit(2);
}

export async function main(argv) {
  const [cmd, ...rest] = argv;
  if (['wait', 'start', 'sweep'].includes(cmd) || (cmd === 'ps' && rest.includes('--hooks'))) requireRepo();
  switch (cmd) {
    case 'wait': return cmdWait(rest);
    case 'ps': return cmdPs(rest);
    case 'status': return cmdStatus(rest);
    case 'stop': return cmdStop();
    case 'reap': return cmdReap();
    case 'sweep': return cmdSweep();
    case 'start': return cmdStart();
    default:
      process.stdout.write('usage: gh-events <ps|status|stop|reap|sweep|start|wait>\n');
      process.exitCode = cmd ? 2 : 0;
  }
}
