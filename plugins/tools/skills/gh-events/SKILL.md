---
name: gh-events
description: Use when waiting on GitHub PR/CI state — CI checks to finish, a review (e.g. Copilot) to land, a PR to become mergeable — or before polling `gh pr checks`/`gh pr view` in a loop or on an interval. Blocks on pushed webhook events instead of polling, so it does not burn the GraphQL rate limit.
---

# gh-events — wait on GitHub state without polling

There is a local event watcher that holds a WebSocket to GitHub's webhook relay
and blocks until a PR reaches a state, instead of polling. **Prefer it over any
`gh pr checks` / `gh pr view` poll loop** — polling burns the shared 5,000/hr
GraphQL bucket; this uses 1 to 3 REST calls to seed (see below), then none while waiting.

Executables (on PATH from the tools plugin's `bin/`):

## Wait for a state (run as a BACKGROUND task, then let the harness wake you)

```sh
gh-wait --pr <N> --for ci|review|mergeable|any --timeout <seconds>
```

- Run it as a **background Bash task**. It blocks until the condition is met, then
  exits — the harness re-invokes you on exit. No polling in between.
- **Exception: subagents** run it in the **foreground** with `--timeout 540`, repeating as
  needed. A returned subagent cannot be resumed, so nothing may wake it later.
- **No `gh` login (claude.ai cloud / Projects threads):** gh-wait cannot run. Use the
  `subscribe_pr_activity` tool on the PR and end the turn; PR events wake the session.
- Prints one JSON line: `{"satisfied":true,...,"source":"seed"|"event","detail":{...}}`
  (`seed` = already true at startup, no daemon; the seed costs 1 REST call, 2 for `review`, 3 for `ci`). Timeout → `{"satisfied":false,"timedOut":true}` and exit code 3 → fall back to a single `gh` check.
- Kinds: `ci` (all checks complete), `review` (a review submitted), `mergeable`
  (PR became mergeable), `any` (any event referencing the PR).

## Inspect / snapshot / clean up

```sh
gh-events ps [--hooks]     # daemon + live leases; --hooks adds a leak check (1 REST call)
gh-events status --pr <N>  # folded snapshot from the local log (0 API calls)
gh-events stop | reap | sweep   # stop daemon / drop dead leases / delete leaked webhooks
```

## What to rely on

- The daemon is **lazy and self-cleaning**: it exists only while a `gh-wait` is
  active, then self-exits and deletes its GitHub webhook. No lingering processes
  or hooks. If a session was hard-killed, `gh-events ps --hooks` spots a leak and
  `gh-events sweep` reaps it.
- Repo is the current directory's GitHub `origin` (override with `GH_EVENTS_REPO=owner/name`), port 8765 (`GH_EVENTS_PORT`). State lives in `~/.local/state/gh-events`.

Full docs: the README next to the app (the tools plugin's `lib/gh-events/`).
