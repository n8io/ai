---
name: next-issue
description: Use when the user wants to start the next unit of GitHub-issue-driven work end-to-end (selection → plan → implement → PR → merge → cleanup).
---

# Next Issue

End-to-end workflow for taking one GitHub issue from selection to merged PR.

## Goal

- Establish a solid, ambiguity-free implementation plan. Ask questions until every clarifying question is answered.
- In an ideal happy-path flow, no additional questions should be needed once implementation begins.

## Workflow

### 1. Ticket Selection

- If there is a task in context that the user prompted, make that the current "ticket".
- Otherwise, select and claim the next ready issue per `references/ticket-selection.md`
  (ranking, exclusions, claim command). If nothing is ready, report the next ticket that needs
  grooming and stop.

### 2. Branch + Workspace Setup

- Ensure work starts from the latest `main` (`git fetch origin && git checkout main && git pull --ff-only`).
- Create a fresh worktree for the task (see `superpowers:using-git-worktrees`).
- **Toolchain gate — do this BEFORE reading code, writing tests, or editing anything.** A wrong
  Node version or stale `node_modules` produces phantom failures that get debugged as if they
  were real bugs, and they surface *late* — after a plan is written and half-implemented.
  1. **Activate the repo's pinned runtime version, and PROVE it.** Find how the repo pins it (a
     version file, an engines field, a toolchain config) and activate exactly that version with
     whatever version manager the machine has — do not trust the shell default, which is often
     older. Then **print the active version and compare it to the pin**. A silent fallback to the
     default is the common failure, so check the printed version, not the exit code. If the pinned
     version is not installed, install it rather than proceeding on a near-enough one.
  2. **Install dependencies to the lockfile.** Use the repo's own package manager (as declared in
     the manifest / implied by the lockfile) in its lockfile-respecting mode, so the tree matches
     the lockfile. If the worktree shares its dependency directory with the main checkout via
     symlink, run the install **in the main checkout first**, then symlink — a symlink to a stale
     tree is stale in both places.
  3. Only once the version matches and the install has completed do you touch code or run tests.
- Re-assert the toolchain in any long-lived shell you open later (background command, subagent,
  new pane): environment exports do not persist across Bash calls, and a mid-run drop back to the
  default runtime reads as a test regression.

### 3. Clarification Phase

- Resolve all clarifying questions before implementation.
- When uncertain, ask early.
- Do not proceed with ambiguous requirements.

### 4. Planning / Spec

- Write a detailed implementation plan/spec (see `superpowers:writing-plans`).
- If there are no remaining unanswered questions, proceed automatically. **Do not ask for approval to continue.**

### 5. Implementation

- Implement the plan/spec.
- Execute with subagents (see `superpowers:subagent-driven-development`). Tag each plan task with a model per the global AGENTS.md "Choosing models" section, and hand each implementer the relevant files and patterns you already found instead of having it re-explore.
- Commit only when a unit of work is code-complete.

### 6. Review + Quality Passes

Do not prompt to proceed unless there is a valid, mission-critical question. Just start reviewing.

- **Final review** — run a final review of completed changes.
- **Simplification pass** — run `/code-review` and address any resulting issues.
- **Stack-specific passes** — run any review skills that apply to this project's stack (per project AGENTS.md), e.g. `/vercel-react-best-practices` or React Router framework-mode validation on React repos.

### 7. Validation

- Run formatting.
- Ensure all checks/tests pass locally (see project `AGENTS.md` `## Verify` section).
- **Cover what CI runs, not just what the docs list.** A project's documented verify command is
  frequently a *subset* of its CI pipeline — suites needing a database, a browser, or an external
  service are usually a separate command CI invokes as its own job, and the documented one
  silently skips them. A green local gate reporting thousands of passing tests then says nothing
  about those, and the gap surfaces as a red CI job only after you have pushed.
  - Once per branch, read the CI workflow definition and list the jobs it runs. For each, name the
    local command that covers it. A job with no answer is a hole in your gate: run it too, standing
    up whatever it needs (a container, a migration, env vars).
  - Weight this by what you touched. Changes to a shared domain rule, a data-access adapter, or a
    migration are precisely what the uncovered suites catch, because fixtures over there encode
    the old rule and nothing in the fast suite does.
  - Beware silent no-matches: a runner configured with multiple projects can match **zero** files
    when you name a path belonging to a different project, and exit as if it passed. Confirm the
    reported test count is non-zero and plausible before believing a green.

### 8. Pull Request

- Push a PR once formatting is complete, all checks are green, and previous workflow steps are followed.
- **Standing grant (2026-06-11): every `git push` in this workflow is pre-approved — never ask.** Session permission gates apply to the merge, not pushes.
- **Do NOT send a PushNotification for PR opened / merged / CI green / CI failed (user decision, 2026-07-21).** In this workflow, notifications are reserved for things needing the user to ANSWER — a clarifying question, a permission prompt, a re-auth relay. Everything else goes in the chat summary. ("other user facing notifications are noise")

### 9. Copilot Review Loop

- **Low-risk PRs skip the wait.** If the diff touches only docs (`*.md`, `docs/`), user-facing
  copy with no logic change, or config values, do not wait for Copilot: merge once the local gate
  and `/code-review` are green. Not low-risk, ever: migrations, CI workflows, dependency or
  lockfile changes, auth, permissions. If Copilot has already posted threads, handle them.
- Otherwise wait for Copilot review with `gh-wait --pr <n> --for review` (see `gh-events`).
- If feedback exists:
  - Resolve issues locally.
  - Verify locally again.
  - Push updates to the PR.
  - Resolve issues remotely — inline if possible, otherwise a single top-level feedback-resolution comment suffices.
- Copilot auto-reviews shortly after PR open; it cannot be requested via the API and is not re-requested after a fix push. Reply to each review thread with the fix + commit SHA and resolve it. A review covers only the commit it names — compare that commit against current `HEAD` before treating "0 unresolved threads" as complete.
- **Read the review body, not just the inline-comments endpoint.** A review can report "generated
  no new comments" while listing real findings in a collapsed *suppressed comments* section of its
  body. Those create no threads and appear in no comments listing, so a thread-count check sails
  straight past them — and they are not reliably nits. Triage them exactly like inline comments:
  verify each claim against the code yourself, fix what is real, and say plainly on the PR what you
  did with each, since there is no thread to resolve as a record.
- Push back on findings you judge wrong, with reasoning, rather than complying reflexively — but
  verify the claim against the source before deciding either way.

### 10. Remote Verification

- Verify all remote CI checks are green.
- **Repos that use `[ci skip]` on intermediate commits** (check project memory): once the PR is
  otherwise merge-ready, push one final commit without the marker so remote CI runs once on the
  head (an empty `git commit --allow-empty -m "ci: run checks before merge"` is fine), wait with
  `gh-wait --pr <n> --for ci`, and merge normally. `--admin` is only for a run where the user
  explicitly turned CI off.
- Otherwise wait for all remote checks green with `gh-wait --pr <n> --for ci`.

### 11. Merge

- Squash-merge the PR.
- **Permission is granted to squash-merge automatically** when **both** conditions hold:
  - All Copilot review feedback has been addressed and resolved (inline or via top-level resolution comment).
  - All remote CI checks are green after the latest push (or, in a run where the user turned CI off, the local gate is green).
- If either condition is not met, stop and ask before merging. This is the only exception to the global "never merge without explicit approval" rule, and it applies only within this `/next-issue` workflow.

### 12. Cleanup

- Clean up local branches/worktrees.
- Return the local environment to `main` with the latest changes.
- **Release the claim:** remove the `in-progress` label from the issue (`gh issue edit <n> --remove-label in-progress`). If the merge auto-closed the issue, the label still needs removing so it does not linger on the closed ticket.

## Abort handling

If work is abandoned before merge (user cancels, blocked, deprioritized), **remove the `in-progress` label** so the ticket re-enters the selectable pool. Never leave a stale claim.
