// Central config + filesystem layout. Runtime state lives under one state dir
// (never next to the code, which may sit in a git checkout) so a hard-killed
// session leaves no mystery — `gh-events ps` reads it all back.

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const ROOT =
  process.env.GH_EVENTS_STATE || join(process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state'), 'gh-events');
export const LEASES_DIR = join(ROOT, 'leases');
export const EVENTS_FILE = join(ROOT, 'events.jsonl');
export const STATE_FILE = join(ROOT, 'state.json');
export const LOCK_FILE = join(ROOT, 'daemon.lock');
export const LOG_FILE = join(ROOT, 'daemon.log');
mkdirSync(LEASES_DIR, { recursive: true });

// The owner/name repo to watch: GH_EVENTS_REPO, else the GitHub origin of the
// current directory. Exported back to the env so a spawned daemon watches the same repo.
function originRepo() {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return url.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/)?.[1] ?? '';
  } catch {
    return '';
  }
}
export const REPO = process.env.GH_EVENTS_REPO || originRepo();
if (REPO) process.env.GH_EVENTS_REPO = REPO;
export const PORT = Number(process.env.GH_EVENTS_PORT || 8765);

// Events we forward. Enough to answer ci / review / mergeable / any without noise.
export const EVENTS = [
  'check_suite',
  'check_run',
  'status',
  'workflow_run',
  'pull_request',
  'pull_request_review',
  'pull_request_review_comment',
  'issue_comment',
];

// Lifecycle timings (ms).
export const HEARTBEAT_MS = 5000; // how often the daemon checks leases
export const STARTUP_GRACE_MS = 15000; // don't self-exit right after boot
export const IDLE_GRACE_MS = 10000; // shut down this long after the last live lease
export const WAIT_POLL_MS = 500; // how often gh-wait re-reads the local event log
