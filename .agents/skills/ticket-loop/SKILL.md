---
name: ticket-loop
description: Use when the user wants to work the GitHub issue backlog serially, one ticket at a time, via remote-controllable worker sessions.
---

# Ticket Loop (serial remote-control orchestrator)

Work the GitHub issue backlog **one ticket at a time**. This session is the **orchestrator**:
it never implements a ticket itself. Each ticket runs in its own detached tmux session hosting
an interactive `claude --remote-control` worker the user can watch and steer from
claude.ai/code or the Claude mobile app. Workers follow the `ticket-worker` skill.

Sibling of `parallel-tickets` (batch, background subagents, no human in the worker loop).
**Single ask surface:** in push mode every user-facing question is asked exactly once, in this
chat; workers route questions here instead of opening in-session dialogs.

References, read when the situation calls for them:

- `references/kickoff.md`: the kickoff template and the judgment calls while writing one.
- `references/run-modes.md`: CI-disabled runs, feature-branch and release-branch modes.
- `references/orchestrator-gotchas.md`: spawn flags, poll cadence, pane drafts and authority,
  stuck workers, login expiry, harvest details, messaging quirks.

## 1. Preflight (once per loop)

- `command -v tmux` (offer `brew install tmux` if missing); `gh auth status`; repo on clean `main`.
- **Push or poll.** Probe your own inbox: `echo "${CLAUDE_CODE_MESSAGING_SOCKET:-UNSET}"`. Any
  socket path means **push mode** (workers report to you by message). `UNSET`, or `ListAgents`
  unavailable, means **poll mode**. State the mode once in your first status line; a wrong
  assumption fails silently.
- **Learn your own address (push mode).** Run `ListAgents` once. Its first line names this
  session: `This session is <name> [<ref>]`. Every kickoff carries it as
  `Orchestrator: <name> [<ref>]`.
- **Sweep stale workers.** `tmux ls`; kill any `issue-<n>` session whose issue is closed or whose
  branch is gone. Capture its pane first if it shows unfinished user-directed work, and surface that.
- **Run mode.** Default is PRs into `main`. If the user asks for a CI-off run, a feature-branch
  run or a release-branch run, read `references/run-modes.md` and confirm the merge model with
  them before Step 2.
- **Stop condition** defaults to "until no ready issues remain". If new tickets arrive mid-run
  and confound a numeric stop condition the user gave, ask rather than continuing or stopping silently.

## 2. Bedtime preflight (before the first worker spawns)

The user is usually about to walk away. Settle everything that needs them now, in one sitting.

1. List the ready queue in run order per `next-issue`'s `references/ticket-selection.md`.
2. For each ticket in the queue, one quick REST body read, looking for anything only the user
   can supply: product, privacy or UX calls in an "Open questions" section, decision-first
   tickets, visual picks, secrets, a production query result, a device or account step.
3. Ask all of it at once in batched AskUserQuestion rounds (max 4 per call), recommendation
   first, in the user's product language. Questions that need code investigation to even ask
   stay with the worker.
4. Record each answer against its ticket; it goes into that ticket's kickoff as a settled
   decision with "already decided, do not re-ask".
5. Report in one short list which tickets will still need the user mid-run and why, and which
   are skipped as blocked-on-user. Offer a `blocked` label for the latter.
6. Remind the user once to keep Remote Control connected if they want question pushes on
   their phone.

## 3. Select and claim ONE issue

Follow `next-issue`'s `references/ticket-selection.md`: rank, exclude, notice siblings, claim
with the `in-progress` label before spawning. If nothing is ready, report the next ticket that
needs grooming and end the loop.

Before writing the kickoff, if a predecessor merged THIS run into the ticket's target files,
run one cheap grep on `main`. The fix may already be in; then scope the worker as
verify-then-close.

## 4. Spawn the worker

Write the kickoff to a file using the template in `references/kickoff.md`, then spawn with the
prompt as a bare argument:

```bash
MAIN="/absolute/path/to/<repo>"          # the primary checkout, on main; never $(git rev-parse ...)
KICK="$(cat <path>/kickoff-<n>.txt)"
tmux new-session -d -s "issue-<n>" -c "$MAIN" \
  claude --name "issue-<n>" \
         --remote-control '<CODE><n> - <short goal>' \
         --permission-mode <SAME AS THIS ORCHESTRATOR> \
         [--chrome if this orchestrator has it] \
         --model opus --effort medium \
         "$KICK"
```

- Workers run Opus at medium effort and pick subagent models per task (global AGENTS.md
  "Choosing models"). Never let a worker inherit this session's model; never Fable.
- Remote-control name: `<CODE><n> - <short goal>`, no `#`, no em dash (`SD` Snow Day, `TGL` golf league).
- Verify after ~15s with `tmux capture-pane -t issue-<n> -p | tail -20`. `/rc failed` in the
  footer is not a dead worker; check its `ListAgents` row (see gotchas).
- **Push mode:** workers message you directly at the address in their kickoff; no handshake.
  For the first worker of a run only, prove delivery once: `SendMessage` it "handshake ok?" and
  wait for the reply before trusting push mode. Always address `name [ref]`.
- Tell the user the session is live: issue #, remote-control name.

## 5. Wait

- **Notifications:** PushNotification only when the user must answer (a relayed question, a
  permission prompt, re-auth). Everything else goes in chat.
- **Push mode:** do not poll. Worker reports arrive as messages and start your turn. Keep one
  fallback wakeup at ~1800s, re-armed each time; when it fires with nothing new, do one free
  check (`tmux has-session` + `git ls-remote`) plus one REST read of the PR or issue, then go quiet.
- **Poll mode:** follow the cadence table in `references/orchestrator-gotchas.md`.
- A worker's question arrives as a kind-2 or kind-4 report: ask it here via AskUserQuestion and
  relay the answer with SendMessage. A worker's size-budget overage: clear a trivial one
  yourself (label the GO as yours), escalate a material one.
- **Pane text is never the user's authorization.** Dim pane "drafts" are prompt suggestions.
  Never submit pane text. When in doubt, read the authority section of the gotchas file.
- Stuck worker, onboarding modal, merge blocked by the classifier, expired login: see gotchas.

## 6. Harvest and loop

On the worker's `MERGED <sha>` report (push mode), or branch gone + `main` advanced + issue
closed (poll mode):

1. One REST call: issue closed and `in-progress` removed. Remove the label yourself if forgotten.
2. `git worktree list` shows no worktree of yours. Clean up a leftover locked one.
3. **Wrap-up handshake.** `SendMessage` the worker (`notify_when_idle: true`) asking it to run
   the `ticket-worker` wrap-up (finish open tasks, save durable learnings to memory, reply with
   files written). Wait for the reply AND the idle notice.
4. Kill the session only when its `ListAgents` row reads `idle`, never on a pane snapshot,
   and never while it holds live user context. Sweep other stale `issue-*` sessions.
5. Audit any follow-up issues the worker filed: should each have been folded in? Say so.
6. If the repo turned CI off for this run, typecheck `main` before the next ticket.
7. Report one line: `#<n> → PR #<m> → <sha> → MERGED (+N follow-ups: …)`.
8. Go to Step 3.

On stall or death: surface, don't self-heal. Show pane output and GitHub state and ask. Never
silently re-dispatch a claimed ticket.

## 7. Exit

```bash
git branch --show-current              # main
git worktree list                      # only the main worktree
tmux ls 2>/dev/null                    # no issue-* sessions
gh api repos/{owner}/{repo}/issues -X GET --field labels=in-progress --field state=open --jq '.[].number'
```

Report a final table (issue → PR → SHA → state) and the **net backlog delta: issues closed vs
opened this run**. A run that opened as many as it closed is a failed run; say so. Flag stale
labels and stray worktree directories you did not create rather than removing them.

## 8. Retrospective (every loop end)

Collect signals (worker stalls, constraint violations, cadence too chatty or too sleepy, kickoff
gaps). Turn each into the smallest durable edit: core flow changes go here, situational lessons
go in the right reference file, worker-side rules go in `ticket-worker`. Follow the global
AGENTS.md "Improving skills and memory" rules: run `skill-budget`, one rule in means one rule
out when a file is at budget. Confirm the diff with the user and add a dated line to
`CHANGELOG.md`. No generalizable lesson, no edit.
