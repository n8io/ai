---
name: ticket-worker
description: Use when you are a worker session or subagent assigned ONE already-claimed GitHub issue by an orchestrator (ticket-loop, parallel-tickets, ship). Holds the fixed worker contract so kickoffs only carry the issue, the settled decisions and repo-specific gates.
---

# Ticket Worker

You were handed one GitHub issue by an orchestrator. This skill is your contract. The kickoff
gives you only what varies per ticket:

- **Issue** number and title.
- **Mode**: `push` (interactive session, report to the orchestrator by message), `poll`
  (interactive session, no messaging), or `subagent` (background subagent, no human).
- **Settled decisions**: the user's answers and the agreed plan. These are final.
- Optional: **context pack** path, **size budget**, **predecessor notes**, **repo gates**
  (extra verify commands, service stack, baseline test count), **branch base** (if not `main`),
  and flags such as **decision-first** or **prototype-then-decide**.

If the kickoff and this skill disagree, the kickoff wins for that ticket.

## 1. Assignment

The issue is already claimed for you (`in-progress` label). SKIP ticket selection. Never list
issues, never touch any other issue.

## 2. Context first, then build

- **If the kickoff names a context pack, read it before anything else.** It is the result of an
  exploration pass someone already paid for: relevant files, patterns, test layout, commands,
  gotchas. Trust it. Explore only what it does not cover, and stay inside the files it lists
  for your ticket unless the code proves you need more.
- **Speak the glossary.** Name everything with the ticket's **Terms** and `CONTEXT.md`. A term
  you need that is not there is a question (section 3), not an invention. Add agreed terms to
  `CONTEXT.md` in this PR, and run `glossary-check` before opening it.
- Before you finish, **append what you learned** to the pack's `## Findings` section: one dated
  line each for gotchas, wrong assumptions in the pack, and seams you left for later tickets.
  Later tickets start from what you found.
- Then invoke `next-issue` and follow it **from Step 2 (worktree + toolchain gate) onward**.
  Its Clarification Phase is replaced by section 3 below.

## 3. Questions

Settled decisions are inviolable. The plan's technical details are a baseline: if the code
proves one wrong, deviate and record why in the PR body, as long as every user decision holds.

For a genuinely new question:

- **push**: Every question for the user, clarifying questions and decision gates alike, goes
  only through your orchestrator as a milestone report (kind 2 or 4 below). Then WAIT for the
  relayed answer. Never open an in-session AskUserQuestion dialog: the user is not watching
  this session, the open dialog blocks your inbox so the relay cannot reach you, and the user
  gets asked twice.
- **poll**: Ask in-session and wait. The user answers remotely.
- **subagent**: You cannot ask a human. Do not guess on anything irreversible. ABORT: remove the
  `in-progress` label and return `ABORTED-NEEDS-CLARIFICATION` with one-line question, one short
  concrete example, 2–4 short options, and your recommended default. No paragraphs.

Never guess on genuine ambiguity, and in push or poll mode never abort for lack of answers.

**Decision-first tickets** (flagged in the kickoff, or the central question is a product,
privacy or UX call): after investigating, your FIRST action is to ask the question. Do not write
a plan or touch implementation code until it is answered. Do not rationalize a guess as obvious.

**Prototype-then-decide** (flagged in the kickoff): build a prototype that coexists with the
current code and touches nothing production-facing, run full verify, measure the real numbers,
then STOP at a hard gate with evidence and a recommendation. Merge only after the relayed GO.
Visual evidence goes in a comment on the issue (see media rule) so the user can see it on a phone.

## 4. Reports

**push mode** — `SendMessage` to the orchestrator address in your kickoff (`Orchestrator:
<name> [<ref>]`), always with the ref. If the orchestrator messages you first, answer it.
Send ONE line at exactly these five moments and no others:

1. **PR opened**: issue #, PR #, URL, changed-files and added-lines counts.
2. **Blocked on a human**: clarifying question, permission prompt, or expired login. Say which.
3. **Size-budget overage**: your real numbers against the budget. Then WAIT.
4. **Decision gate**: the question, verbatim. Then WAIT.
5. **Finished**: `MERGED <sha>` or `ABORTED <reason>`, sent AFTER your own cleanup (label
   removed, worktree removed, back on main).

No progress narration. Each message costs the orchestrator a turn, and repeats are rate-limited
and dropped. If a send fails, do not retry in a loop; fold it into your next report.

**subagent mode** — your final returned message is the report: issue #, final state (MERGED /
PR-OPEN / ABORTED / ABORTED-NEEDS-CLARIFICATION), PR # and URL, one-paragraph summary,
follow-ups, and confirmation the label is removed and the worktree cleaned up.

## 5. Working rules

- **Fold in, don't fork.** When you find something related to this ticket, finish it here. File
  a separate issue only when it is genuinely unrelated, needs a different product decision, or
  is large enough to be its own epic. When unsure, ask. A finding that would make your change
  wrong, incomplete or misleading is in scope by definition. Say plainly in the PR body what you
  deferred and why.
- **Distrust the ticket's claims.** Severity ("cosmetic", "low risk") is a hypothesis to verify.
  Counts, inventories, "zero importers", file lists come from one earlier grep: re-derive them
  and expect them to differ, usually an undercount. Distrust them doubly when a predecessor just
  merged into the same files. Verify a dependency's real behaviour by reading its `dist/`, not its docs.
- **Size budget** (if given) counts tests, fixtures and the plan doc, not just production code.
  If your final diff exceeds it, or materially exceeds a size you were authorized for, report
  the real numbers and WAIT for an explicit GO before merging.
- **Sabotage-verify every new test.** Commit first. Break the production code and confirm the
  test (1) goes red, (2) for the right reason (read the failure message), and (3) the mutation
  actually landed (grep for it). Verify each site independently. Re-run at least one mutation
  yourself rather than trusting a subagent's report.
- **Owned files.** If the kickoff lists files owned by other live tickets, do not edit them.
  If you must, report it (push mode kind 2) and wait for the orchestrator's answer.
- **Progress tracker.** If the kickoff gives a tracker URL and step id, update that step's
  `live` and `liveAt` with `ArtifactData` at each phase (planning, implementing, testing, review
  round N). If the write fails, skip it; the orchestrator updates from your reports.
- **Worktree hygiene.** Verify `pwd` and `git branch --show-current` before editing. Use paths
  relative to the worktree root; absolute paths can resolve to the outer checkout. Stage by
  explicit path, never `git add -A`. Never hand-write migrations.
- **Screenshots** for browser verification go in a scratch dir inside your worktree (e.g.
  `<worktree>/tmp/`), not `/tmp`, so reading them back needs no permission prompt.
- **Media goes directly on the PR or issue.** Open it on github.com with the claude-in-chrome
  tools, edit the description, upload with `file_upload`, save. If the browser tools are
  unavailable or the upload fails twice, publish without images and say so in your Finished
  report. Never create a branch for images.
- **Models.** Follow the global AGENTS.md "Choosing models" section: tag each plan task opus,
  sonnet or haiku when you dispatch it, and give implementers the context pack slice instead of
  telling them to explore.
- **API quota.** Prefer REST (`gh api`) and `git ls-remote`. `gh ... --json`, `gh issue edit` and
  review-thread queries are GraphQL and may fail when the quota is gone. Thread resolution needs
  GraphQL (`resolveReviewThread`): wait and retry rather than skipping it.

## 6. Merge discipline

Do NOT open the PR and then park.

- Wait on GitHub with `gh-wait` (see the `gh-events` skill), never a poll loop. In **subagent**
  mode run it in the foreground with `--timeout 540` and repeat as needed: no Monitor tool, no
  background Bash, nothing that resumes you later, because a returned subagent cannot be resumed.
  Kill anything you started in the background before returning.
- Run the review loop from `next-issue` Step 9: fix each finding, reply inline with the fix and
  SHA, resolve the thread. Read the review body too, including suppressed comments.
- If Copilot's review infra-errors and posts no threads, do not wait for it: with the local gate
  green and your sabotage checks done, 0 threads meets the ruleset.
- Then the repo's final CI step (`next-issue` Step 10), the pre-merge rebase check, and
  squash-merge immediately. Do not schedule another wait.
- After the merge lands, finish your own cleanup BEFORE going idle: remove the `in-progress`
  label, remove your worktree, return to main. Then send your Finished report.
- If your login expires, STOP and report that you need re-auth. Do not spin.
- On abort, always release the `in-progress` label.

## 7. Wrap-up

When the orchestrator asks for wrap-up (push and poll modes), finish any open task, then save
durable learnings from this ticket to memory: gotchas, user rulings, toolchain or rig fixes.
Update existing files rather than duplicating. Reply with one line naming the files you wrote,
or "none".
