---
name: ship
description: Use when the user hands over a bug, feature, epic, issue number, or idea and wants it planned and built end to end as fast as the dependency graph allows, or says /ship with no argument to work the ready backlog. Orchestrates parallel tmux workers over a ticket dependency graph.
---

# Ship

`/ship <bug | feature | epic | #issue | idea>`, or `/ship` alone to work the ready backlog.

This session is the **orchestrator**. It never implements a ticket. It turns the input into a
dependency graph of tickets, explores the code once into a context pack, then runs every ready
ticket in parallel in its own tmux worker, dispatching dependents the moment their blockers merge.

Built on: `idea-to-tickets` (grill and decompose), `ticket-worker` (the worker contract),
`next-issue` (the per-ticket steps and `references/ticket-selection.md`), `ticket-loop`'s
`references/kickoff.md` and `references/orchestrator-gotchas.md`, and `progress-tracker`.
Once `/ship` has run one real epic cleanly, `ticket-loop` and `parallel-tickets` retire.

## 1. Preflight

- Repo on clean `main`, `gh auth status` OK, `tmux` present.
- This session should have been started with `cs` (bypassed permissions, Chrome, Remote
  Control). If `echo "$TMUX"` is empty or the permission mode is not bypass, say so once: workers
  must run in the same mode as this session or their messages are held.
- **Messaging.** `echo "${CLAUDE_CODE_MESSAGING_SOCKET:-UNSET}"`. Any socket path means push mode.
  `UNSET` means workers cannot report to you: fall back to poll mode per the gotchas file and say so.
  In push mode run `ListAgents` once; its first line (`This session is <name> [<ref>]`) is the
  orchestrator address every kickoff carries.
- Sweep stale `issue-*` tmux sessions whose issues are closed.

## 2. Intake

Classify the input and build the graph.

- **A bug (fast path).** Reproduce it. Ask only if the expected behavior is unclear. File one
  ticket in the `idea-to-tickets` body format with its owned files and a small context pack,
  then go to step 4. If investigating shows it is really several separate fixes, say so and
  switch to the feature path.
- **A feature, epic or idea.** Run `idea-to-tickets` end to end: grill, prototype, verify
  premises, write the context pack, decompose into a graph with a contract ticket first and
  owned files per ticket, groom, file with blocked-by and sub-issue links.
- **An existing issue or epic number.** Read the graph from GitHub (sub-issues and blocked-by
  links). For tickets missing owned files or a context pack, run one read-only exploration pass
  to fill them in and add the owned files to each body. Re-grill only if a ticket still has
  open questions.
- **Nothing (backlog mode).** The ready set comes from `references/ticket-selection.md`. Run
  one exploration pass over the selected tickets to build a shared context pack.

The context pack lives at `<main checkout>/.claude/scratchpad/context/<run-slug>.md`, never
committed. It has a section per ticket and a `## Findings` section workers append to.

## 3. Before you leave

Run `ticket-loop`'s bedtime preflight (its Step 2) over the whole graph: every question only the
user can answer gets asked now, in batched rounds, and each answer is recorded as a settled
decision for its ticket.

Then create **one progress tracker for the run** with `progress-tracker`:

- One step per ticket, in topological order: `title` is `#<n> <short title>`, `note` names its
  blockers (`waits on #12, #13`) and owned files.
- Status mapping: `todo` = waiting on blockers, `active` = worker building, `review` = PR open,
  `done` = merged, `blocked` = waiting on the user.
- `meta/current.ticket` is the epic (or the single ticket); `now` is a one-line headline.

Give the user the tracker link once.

## 4. Schedule

Loop until every ticket in the graph is merged or the user stops the run.

**Ready** = open, not `in-progress`, zero open blockers, and owned files disjoint from every
live ticket's owned files. Dispatch ready tickets until **4 workers** are live (the user can
change the cap per run).

For each dispatched ticket:

1. Claim it with the `in-progress` label (selection reference).
2. Write its kickoff with the template in `ticket-loop`'s `references/kickoff.md`, mode `push`.
   Include: `Orchestrator: <name> [<ref>]`; the context pack path and the ticket's section in it; owned files; the owned files
   of every other live ticket ("do not edit these; report kind 2 if you must"); the tracker URL
   and this ticket's step id; settled decisions; predecessor notes from blockers that merged.
3. Spawn it per `ticket-loop` Step 4 with `--permission-mode bypassPermissions --chrome
   --model opus --effort medium`, `--name issue-<n>`, Remote Control `<CODE><n> - <goal>`.
4. Set its tracker step to `active` and add a log line. For the run's first worker only, send
   "handshake ok?" and wait for the reply to prove delivery works.

Workers update their own step's `live` field in the tracker. If a worker cannot write to it,
update the step yourself from its reports.

**On each worker report:**

- **PR opened** → step `review`.
- **Blocked on a human / decision gate** → ask the user here (single ask surface), step
  `blocked` until answered, relay the answer.
- **Needs a file another live ticket owns** → tell it to wait until that ticket merges (then
  rebase), or, if the edit is tiny and the other ticket is early, let it proceed and warn the
  other worker. Never let two live workers edit one file blind.
- **Size overage** → clear a trivial one yourself, escalate a material one.
- **MERGED** → harvest per `ticket-loop` Step 6 (wrap-up handshake, idle check, kill). Step
  `done`. Carry its decisions and findings into the kickoffs of the tickets it unblocks.
  Recompute ready and dispatch immediately. Dependents always start from fresh `main` after
  the merge, never stacked on an open branch.

Waiting: push mode keeps one ~1800s fallback wakeup and otherwise sleeps until a report
arrives. Everything else (stuck workers, pane drafts, expired logins, merge blocks) follows
`ticket-loop`'s `references/orchestrator-gotchas.md`.

## 5. Integration check (epics and multi-ticket runs)

When the last ticket merges, on fresh `main`:

1. Run the repo's full local CI-equivalent, including the suites CI runs that the docs skip.
2. Drive the feature end to end in the browser against the epic's acceptance list. Capture
   screenshots (desktop and phone width) and post them in a comment on the epic.
3. **Pass** → close the epic with a comment linking every PR. **Fail** → file a fix ticket into
   this run with the failure, its owned files and the context pack, and go back to step 4.

## 6. Exit

- Clean state: on `main`, only the main worktree, no `issue-*` tmux sessions, no lingering
  `in-progress` labels from this run.
- Tracker: every step `done`, `now` set to the outcome.
- One short report: what shipped (issue → PR → merged), the net backlog delta (closed vs opened),
  and anything left waiting on the user.

## 7. Retrospective

Same contract as `ticket-loop` Step 8 and the global AGENTS.md "Improving skills and memory"
rules: collect signals (dispatch collisions, file-ownership misses, context-pack gaps a worker
had to re-explore, questions that reached workers instead of being asked in step 3), make the
smallest edit in the right file, run `skill-budget`, show the diff, log it in `CHANGELOG.md`.
Promote durable findings from the context pack to the repo's memory before deleting the pack.
