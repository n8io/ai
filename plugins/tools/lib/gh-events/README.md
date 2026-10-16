# gh-events — local GitHub event watcher

Replaces polling (`gh pr checks` in a loop) with **pushed webhook events**, so
waiting on a PR costs 1 to 3 REST calls instead of dozens of GraphQL calls. Built
because the GraphQL rate bucket (5,000/hr, shared across all tools) kept getting
exhausted by monitoring loops.

## How it works

A short-lived **daemon** holds a WebSocket to GitHub's webhook relay (via the
`cli/gh-webhook` extension's `gh webhook forward`) and writes every event to a
local log. `gh-wait` blocks on that log until your condition is met, then exits —
so a background `gh-wait` makes the Claude Code harness **wake on the event**,
with no polling in between.

The daemon runs **only while something is waiting**: each `gh-wait` owns a lease
file; when the last live lease disappears the daemon shuts itself down (~25s
grace) and deletes its GitHub-side webhook. Nothing lingers.

## Commands

All on PATH from the tools plugin's `bin/`.

```
gh-wait --pr <N> --for ci|review|mergeable|any [--timeout <seconds>]
```
Block until PR `<N>` reaches the state. Prints one JSON line and exits:
- `{"satisfied":true,...,"source":"seed"}` — already done at startup (no daemon; 1 REST call to seed, 2 for `review`, 3 for `ci`)
- `{"satisfied":true,...,"source":"event"}` — a pushed event satisfied it
- `{"satisfied":false,"timedOut":true,...}` — timed out (exit code 3)

Kinds: `ci` (all checks complete), `review` (a review was submitted),
`mergeable` (PR became mergeable), `any` (any event referencing the PR).

```
gh-events ps [--hooks]   # census: daemon + live leases (add --hooks for a leak check, 1 REST call)
gh-events status [--pr N]# folded per-PR snapshot from the local log (0 API calls)
gh-events stop           # kill the daemon (warns if leases are live)
gh-events reap           # drop lease files whose PID is dead
gh-events sweep          # delete leaked forwarder webhooks (only when no daemon runs)
gh-events start          # start the daemon manually (self-exits ~25s if nothing waits — mainly for debugging)
```

## The intended usage (in monitoring loops)

Instead of a poll loop, run `gh-wait` as a **background task** and let the harness
re-invoke you when it exits:

```sh
gh-wait --pr 1371 --for ci --timeout 1800   # run in background; you're woken when CI finishes
```

Fall back to a single `gh` check on timeout (exit 3). For a cheap snapshot
without blocking, `gh-events status --pr N` reads the local log (0 API calls).

## Design notes / caveats

- **REST-only seed.** `gh-wait` seeds state via `gh api` (REST/core bucket), never
  `gh pr view` (GraphQL) — so it works precisely when GraphQL is exhausted.
- **Watermark.** A wait only counts events that arrive after it starts; stale log
  entries from a previous wait never satisfy a new one. The daemon also truncates
  the event log at startup.
- **Repo.** The GitHub `origin` of the current directory, or `GH_EVENTS_REPO=owner/name`.
- **State.** `${XDG_STATE_HOME:-~/.local/state}/gh-events` (override with `GH_EVENTS_STATE`), never next to the code.
  Port defaults to `8765` (`GH_EVENTS_PORT`).
- **Requires** the `cli/gh-webhook` extension (auto-installed on first daemon
  start) and admin on the repo (to create the ephemeral webhook).
- **Crash cleanup.** A healthy daemon deletes its webhook on exit. If a session is
  hard-killed (SIGKILL), run `gh-events ps --hooks` to spot a leak and
  `gh-events sweep` to reap it.
- **Files.** Everything lives here: `daemon.lock`, `leases/`, `events.jsonl`,
  `state.json`, `daemon.log` — so a census reads state straight off disk.

## Layout

```
lib/match.mjs    # pure: condition matching, seed short-circuit, REST normalize, watermark
lib/leases.mjs   # pure: lease liveness + reaping
lib/store.mjs    # event log + folded state snapshot
lib/hooks.mjs    # forwarder-webhook list/delete
lib/daemon.mjs   # listener + gh webhook forward + lifecycle + cleanup
lib/cli.mjs      # command dispatch (wait/ps/status/stop/reap/sweep/start)
test/*.test.mjs  # unit tests for the pure cores (node --test)
```

Run tests: `node --test 'test/*.test.mjs'` from this directory.
