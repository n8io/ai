// Event persistence + a folded per-PR snapshot.
// - events.jsonl is the append-only log gh-wait tails (source of truth).
// - state.json is a convenience snapshot for `gh-events status` (0 API calls).
// foldEvent is pure so it can be unit-tested; the rest is thin file I/O.

import { appendFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

export function emptyState() {
  return { total: 0, byPr: {}, bySha: {} };
}

function prOf(event) {
  const p = event.payload ?? {};
  if (typeof p.pull_request?.number === 'number') return p.pull_request.number;
  if (typeof p.issue?.number === 'number') return p.issue.number;
  if (typeof p.number === 'number') return p.number;
  return null;
}

export function foldEvent(state, event) {
  state.total += 1;
  const pr = prOf(event);
  if (pr != null) {
    state.byPr[String(pr)] = {
      lastType: event.type,
      lastAction: event.payload?.action ?? null,
      at: event.receivedAt ?? null,
    };
  }
  if (event.type === 'check_suite' && event.payload?.check_suite?.head_sha) {
    state.bySha[event.payload.check_suite.head_sha] = {
      conclusion: event.payload.check_suite.conclusion ?? null,
      action: event.payload.action ?? null,
      at: event.receivedAt ?? null,
    };
  }
  return state;
}

export function appendEvent(file, event) {
  appendFileSync(file, `${JSON.stringify(event)}\n`);
}

export function readEvents(file) {
  if (!existsSync(file)) return [];
  const text = readFileSync(file, 'utf8');
  const events = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // ignore a partially-flushed trailing line
    }
  }
  return events;
}

export function loadState(file) {
  if (!existsSync(file)) return emptyState();
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return emptyState();
  }
}

export function saveState(file, state) {
  writeFileSync(file, JSON.stringify(state, null, 2));
}
