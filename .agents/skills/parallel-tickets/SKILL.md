---
name: parallel-tickets
description: Use when the user wants to work multiple GitHub issues at once via concurrent ticket-manager subagents.
---

# Parallel Tickets (orchestrator)

Run up to **3** GitHub issues concurrently. This session is the **orchestrator**; it never
implements a ticket itself. Each ticket is handled by one background subagent running the
full `next-issue` workflow on a **single pre-assigned issue**.

## Why this is safe

Distinct issues are pre-claimed (`in-progress` label) **before** dispatch, so no selection
race. Each agent works in its own fresh worktree off latest `main`; overlapping edits are
handled by the `next-issue` pre-merge rebase check. Background agents have no human in their
loop, so real ambiguity is resolved with the user **up front** (scout phase → clarification
gate, steps 4–5) — only then are agents told to "proceed without asking." Skipping the scout
phase means genuine questions get silently assumed away inside invisible agents.

## Workflow

### 1. Confirm the two decisions that change outcomes

Use AskUserQuestion (skip any the user already specified):

- **Batch size** — how many issues (cap at 3).
- **Autonomy depth** — per agent: (a) stop at open PR, (b) PR + Copilot loop then ask before
  merge, or (c) full end-to-end incl. auto-merge. (c) means N parallel auto-merges with no
  human gate — only when the user explicitly opts in.

### 2. Pre-select N distinct, implementation-ready issues

Rank and exclude per `next-issue`'s `references/ticket-selection.md`. On top of that:

- **Conflict-aware selection**: within a batch, prefer issues touching disjoint surfaces. If
  two candidates would edit the same page/component/context concurrently, take the
  higher-ranked one and swap the other for the next non-overlapping candidate — tell the user
  which issue you skipped and why (e.g. 2026-07-15: skipped older #561 because its dashboard
  card collided with #560's dashboard work; took #563 instead).
- Pick the top N. Show the user which issues you chose.

### 3. Pre-claim (kills the race)

Claim every selected issue up front with the REST claim command in
`next-issue`'s `references/ticket-selection.md`, before any scout runs.

### 4. Scout phase — surface clarifying questions (parallel, READ-ONLY)

Dispatch one short-lived scout per selected issue (foreground / blocking; `subagent_type: Plan`
or `Explore`, or `general-purpose` told explicitly **not to edit, commit, or branch**). Each
scout:

- Reads its assigned issue + the relevant codebase.
- **Verifies the issue's technical premises against the code** — issue bodies go stale or
  guess wrong (2026-07-15 batch 6: 2 of 3 had false premises — "avatarKey suggests upload
  infra" was a Gravatar hash; "reuse existing live-sync polling" was a write-only buffer).
  Corrections go in `planSummary` and get baked into the implementation prompt.
- Returns a **proposed implementation plan** AND a list of **genuine clarifying questions** —
  only questions a reasonable engineer truly cannot resolve from the issue + code (product
  intent, ambiguous scope, conflicting requirements, OR a significant hard-to-reverse
  architecture-shape call the user may have a directional preference on — e.g. extract a new
  shared abstraction vs. duplicate per call-site). NOT questions answerable by reading code.

**Question format (enforce this in the scout prompt).** Each question must be small enough to
drop straight into an `AskUserQuestion` option set — no paragraphs. Exactly:

- `q`: the decision in ONE sentence (≤ ~20 words).
- `example`: ONE short concrete instance that makes the ambiguity obvious — a real label,
  string, or before/after — ≤ ~15 words. This is the "simple example context"; it replaces a
  paragraph of explanation.
- `options`: 2–4 SHORT choices (a few words each), recommended one first.
- `recommendation`: the default + a ≤ 1-line why.

Keep all surrounding rationale OUT of the question — it belongs in `planSummary`, not in what
the user is asked. Tell the scout: "Report just enough to ask the question with one simple
example; do not restate the codebase analysis in the question."

Example of the right altitude:
```
q: Rename the Settings→Achievements tab to match what it does?
example: tab reads "Achievements" but only has a "Recalculate" button
options: "Recalculate" (rec) / "Achievement Rules" / keep "Achievements"
recommendation: "Recalculate" — the tab has no rule config, only a recalc action
```

Use a structured return so you can aggregate, e.g. each scout returns:
`{ issue, planSummary, contextPack, questions: [{ q, example, options, recommendation }] }`.

**The scout's exploration is reused, not repeated.** `contextPack` is markdown covering what the
scout learned: the files this issue will touch and why, the patterns and helpers to follow,
where its tests live and how to run them, and gotchas. Write each one to
`<main checkout>/.agents/scratchpad/context/issue-<n>.md` with a trailing `## Findings` section,
and pass that absolute path to the implementer. The implementer starts from it instead of
re-exploring the codebase.

Run scouts concurrently and wait for all (this is a barrier — you need every question before
you can batch them to the user).

### 5. Clarification gate (the user)

- Pool all questions across all tickets. De-duplicate overlapping ones.
- If **zero** real questions surfaced, skip straight to dispatch — note that you did.
- Otherwise ask the user in **batched `AskUserQuestion` rounds** (max 4 per call). Put the
  scout's one-line `q` as the question, fold its `example` into the question text (e.g.
  `... (currently: "Achievements" tab → only a Recalculate button)`), and use the scout's
  `options` verbatim with the recommendation first + "(recommended)". Keep it skimmable — the
  user should grasp each question in one read without you pasting plan rationale.
- Record each answer against its issue. These answers + the scout's plan become the contract
  baked into the implementation prompt. Do NOT dispatch implementation until this gate clears.

### 6. Dispatch one implementation subagent per issue

Launch all N in a single message, each `run_in_background: true`, `subagent_type: general-purpose`.
Each prompt is a short kickoff for the `ticket-worker` skill, mode `subagent`. It MUST contain:

- "You are a ticket worker. Invoke the `ticket-worker` skill and follow it. Mode: subagent."
- **The assigned issue number + title.**
- **The context pack path** from the scout phase.
- **The agreed plan + the user's clarification answers for THIS issue**, stated explicitly as
  settled decisions. This is what makes "proceed without asking" safe.
- **Standing user rules that apply to this ticket type** — check memory/feedback for durable
  rules and bake the applicable ones into the prompt; agents don't inherit them. Known: UI
  interaction-fix PRs require recorded video evidence (shell-side Playwright), uploaded
  DIRECTLY into the PR body through the github.com editor with the claude-in-chrome
  `file_upload` tool — never an `assets/*` branch (user decision 2026-09-24; see ticket-loop's
  media rule). Older PRs whose embeds point at an `assets/*` branch still depend on it, so never
  delete those branches during cleanup.
  Pruning old `assets/*` branches is a deliberate later sweep once the PR is historical, not
  part of any ticket's cleanup. Known: ALL loader-returned data must respect the ADR-0006
  identifier boundary — public NanoIDs only, never internal gids/ULIDs — not just URL params.
- **Spike/doc-only tickets** adapt the same flow: deliverable is an ADR (+ plan doc) on a
  branch → PR; follow-up implementation issues are DRAFTED in the final report for
  orchestrator confirmation, never self-filed (validated 2026-07-16, #579/ADR 0012).
- **Residual overlap heads-up**: if any selected issues still touch a shared file despite
  conflict-aware selection, name the file(s) and sibling issue(s) in each affected agent's
  prompt so it keeps that edit minimal and expects pre-merge rebases onto sibling merges.
  Drizzle migration collisions are the common case: if two siblings both generate migrations,
  tell BOTH up front — when the pre-merge rebase pulls the sibling's migration from main,
  delete your generated migration files and re-run `pnpm db:generate` on the rebased branch;
  never hand-edit the journal.
- **The chosen autonomy depth** (push-only / ask-before-merge / full auto-merge).
- **Plan file**: follow the repo's convention. Where plans ship on the branch, the worker
  commits the settled plan to `docs/superpowers/plans/<YYYY-MM-DD>-<issue-slug>.md`; elsewhere it
  stays uncommitted (global AGENTS.md).

### 7. Orchestrate

- **Completion is push-based** — the harness notifies you when each agent finishes; relay its
  report to the user immediately. Do NOT tail the subagent output file (it's the full JSONL
  transcript and will overflow context). Do NOT run a tight polling loop — you're re-invoked
  automatically on completion.
- **Mid-flight check-ins are pull-based** — when the user asks "check in", poll observable
  GitHub signals (`gh pr list`, `gh pr checks`, Copilot review state) for the assigned issues
  and give a snapshot. Never read transcripts for this.
- **Handle the escape hatch** — if an agent returns `ABORTED-NEEDS-CLARIFICATION`, it hit a new
  question the scout phase missed. Surface that question to the user, get the answer, then
  re-dispatch a fresh implementation agent for that issue (re-claim the label) with the answer
  added to the contract. Feed recurring misses back into the scout-phase prompt over time.
- **Handle a mid-flight "monitoring" return** — despite ticket-worker's no-background-wait rule, an agent may still
  open its PR, arm a "background CI monitor", and return. Don't dispatch a finisher: SendMessage
  the SAME agent (worktree context intact) with explicit orders to poll inline (REST
  check-runs), handle Copilot, rebase-check, merge, clean up — and not return until MERGED or
  ABORTED. The notification firing at all means no live monitor exists; the resume recovers
  cleanly (verified 2026-07-15, #565/PR #600). The FIRST resume message must already include the
  hard mechanism from ticket-worker section 6 — forbid the Monitor tool by name and give the
  `sleep 120 && gh api …` compound-command wait — a generic "poll inline" order let the same
  agent re-arm a monitor and return again (2026-07-15, #570).

### 8. Verify clean exit

After all agents complete:
```
git branch --show-current        # main
git worktree list                # only the main worktree should remain
gh issue list --label in-progress --state open   # none of your issues should linger
```
Report final table (issue → PR → merge SHA → state). Flag any pre-existing stale
`in-progress` labels you didn't create rather than removing them silently.

### 9. Retrospective — improve this skill (run after EVERY batch)

This skill is self-improving. After reporting the final table, do a short retrospective and
fold durable lessons back into THIS file. Do not skip it, even on a clean run ("what went
smoothly that's worth locking in?" is a valid lesson).

**Collect signals from the run:**
- Any `ABORTED-NEEDS-CLARIFICATION` → a question the scout phase should have caught. The single
  highest-value signal.
- Any constraint violation, rework, or near-miss (agent ran `git add -A`, wrong worktree, lint
  reached CI, re-litigated a settled decision, format too verbose/terse).
- Any new gotcha (a command that errors-but-succeeds, a flaky check, a race).
- Repeated friction across agents (all three hit the same review-pass finding → bake the fix
  into the implementation prompt so it never recurs).

**Turn each signal into the smallest durable edit:**
- Scout missed a question type → add that pattern to the scout-phase guidance (Step 4).
- Constraint violated → strengthen the rule in the ticket-worker skill (worker-side) or the Step 6 kickoff (ticket-specific).
- New gotcha → add a bullet to `## Notes`.
- Recurring rework → add a pre-empting instruction to the relevant step.

**Rules so self-improvement doesn't rot the skill** (plus the global AGENTS.md "Improving skills and memory" budget rules; run `skill-budget`):
- Only generalizable lessons. A one-off detail about a specific ticket is NOT a skill edit.
- Prefer editing an existing step in place over appending; the skill must not just grow.
- Confirm proposed edits with the user before writing (it's their playbook). Show the diff.
- Append a dated one-line entry to the sibling `CHANGELOG.md` for every edit, so evolution is auditable.
- If nothing generalizable surfaced, say so and add nothing. No busywork edits.

## Notes

- The `gh pr merge --delete-branch` local-checkout step errors when `main` is checked out in
  the outer worktree — the remote merge + branch delete still land. Verify, don't retry.
- Cap concurrency at 3: more parallel auto-merges against one `main` increases mid-flight
  rebase churn with diminishing return.
- With 3 agents + orchestrator all polling, the shared GitHub **GraphQL** 5000/hr quota (used by
  `gh pr view/checks --json`, `gh issue list --json`, `gh issue edit --add-label`, `gh label
  create`) gets exhausted (it's separate from the REST `core` quota) — and is **often already
  exhausted at session start**, before the orchestrator runs a single command. So this is not
  just a poll-loop concern: assume GraphQL may be dead from the first command and reach for REST
  in Steps 2–3 (issue list, label create + add — see those steps for the exact `gh api` calls)
  as readily as in the poll loops. For poll loops prefer REST (`gh api .../check-runs`); for
  orchestrator check-ins use **git protocol** (`git ls-remote`, `git fetch` + `git log
  origin/main`) — zero API cost, and it still answers "did it merge?" (branch gone + main
  advanced) when GraphQL is throttled.
- Never run two agents on one worktree. If an agent strands a PR (returned before merging), the
  original may not be truly dead and you cannot `SendMessage` it — verify it's actually gone
  before dispatching a finisher, and have the finisher re-fetch + `--force-with-lease`
  defensively rather than assume exclusive worktree access. Better: prevent it via ticket-worker's merge discipline.
- Playwright demos rendered from a worktree dev server need a temporary Vite `server.fs.allow`
  entry for the symlinked `node_modules` path or client hydration fails. Keep it uncommitted
  (2026-07-15, #570).
- A deleted `assets/*` orphan branch is recoverable while its objects survive GC: worktrees
  share the main repo's object DB, so `git fsck --lost-found`, `git ls-tree` the dangling
  commits for the asset filename, and push the found SHA back to the branch name. When
  verifying asset URLs on a private repo, anonymous `curl` always 404s even for healthy
  branches — check via `gh api repos/{owner}/{repo}/contents/<file>?ref=<branch>` instead
  (2026-07-15, #571).
- The permission classifier may deny `gh api -X POST .../issues` (filing follow-up issues) as
  an out-of-scope external write. Don't work around it: collect follow-ups and present them
  for user confirmation at the retrospective instead of filing autonomously (2026-07-15,
  batch 6).
- A completed agent's task-id can fire a second, stale completion notification. If that agent
  was already reported done, ignore it — don't re-relay it or treat it as new state
  (2026-07-15, batch 7).
