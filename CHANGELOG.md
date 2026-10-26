# @n8io/ai-config

## 1.1.3

### Patch Changes

- ed8c8a6: ticket-worker: close every tab in the worker's claude-in-chrome group as part of cleanup (after merge and on abort), so finished workers leave no tab groups behind.
- 4b86228: ship, ticket-worker: when the Skill tool says Unknown skill, read SKILL.md from the plugin by absolute path; UI tickets put phone-width screenshots of every changed screen on the PR before merging.

## 1.1.2

### Patch Changes

- cf46781: ship, ticket-loop: spell out the worker Remote Control name with an example (`TLOEI245 - Bugs and rule breaks`) and a pane-footer check, so a bare repo code is never used as the name.

## 1.1.1

### Patch Changes

- 4bc9a07: idea-to-tickets: drafts name each other by placeholder, not `#n`, and get rewritten to the filed numbers before the graph is linked. A bare `#n` in a draft links to whatever issue or PR already has that number.
- cc9bc6a: ship: collect typed approvals for steps auto mode blocks (always-on services, global installs, secret files, outside services) before dispatch, and in Projects mode check `gh auth` on threads that run on the user's own machine, where the GitHub MCP tools are absent.
- 2a2461b: ticket-loop: the spawn step refuses an empty kickoff instead of starting a worker with no prompt, and kickoffs carry an earlier ticket's repo-wide audit (touch targets, nested links, payload size) into every later ticket that edits the same screens.
- 029ce80: ticket-worker: after merging, fast-forward the primary checkout with `git -C <primary> merge --ff-only origin/main`, never `update-ref`, which moves the ref but leaves that checkout's files behind as staged reverts.

## 1.1.0

### Minor Changes

- 35eae5f: Apply the 2026-10-16 skills retro (slideshow epic). `ship` and `ticket-worker` get a Projects mode (`ship/references/projects-mode.md`) for claude.ai Projects threads: one thread per ticket, thread checklists instead of the tracker, `subscribe_pr_activity` instead of `gh-wait`, the Copilot loop only when the repo has a review bot, evidence in project files, no review request to the PR's own author. Ship adds an environment preflight for the epic's external hosts and asks whether more tickets are coming before the integration check. Workers run fast gates plus the touched area's e2e specs, skip the repo's known failures on main, keep screenshots out of context and re-read memory files before editing. Size budgets count production lines only. `tool-guard.sh` checks git `--force` per command segment, so `git worktree remove --force`, `pkill -f` and `rm -rf` next to git are no longer blocked. `skills-check` shows cloud equivalents, installs fall back to apt without Homebrew, and stale text is fixed (gh-wait background vs foreground, `gh issue edit`, the ticket-loop handshake, gh-events REST call counts).

### Patch Changes

- e67a634: Projects mode: the context pack lives where threads can read it and carries a `## Setup data` section; workers use the repo's helper scripts from AGENTS.md `## Verify`, and finish a PR in a fixed order (assign, skip self-review, subscribe with `pullNumber`, merge with the repo's allowed method).

## 1.0.1

### Patch Changes

- 10be731: Drop the default model and the claude-mem plugin from the settings baseline, so bootstrap no longer adds them to settings that never had them.

## 1.0.0

### Major Changes

- df17c74: Remove the `ai-config` npm installer and its symlink topics. The repo is now the `n8io` Claude Code plugin marketplace with two plugins, `workflow` (skills and subagents) and `tools` (helper CLIs on PATH, safety hooks, the gh-events watcher). `setup/bootstrap.sh` installs both and sets up the global rules, statusline and baseline settings. Other agents install the skills with `npx skills add n8io/ai`. Releases tag each plugin as `workflow--v<version>` and `tools--v<version>` instead of publishing to npm.

### Minor Changes

- 9ed451a: Add the agent workflow skills (ship, ticket-worker, idea-to-tickets, next-issue, ticket-loop, parallel-tickets), the progress-tracker, gh-events, slack, slack-triage and verify skills, a bin topic (cs session launcher, skills-check requirements check, gh-wait/gh-events event watcher, glossary-check, skill-budget, slack-download), a stack-notes skill holding per-language lessons so the workflow skills stay language-agnostic, and a "How I work" section (including an open-standards-first rule, AGENTS.md over CLAUDE.md, and a per-repo CONTEXT.md glossary) in the shared AGENTS.md

## 0.5.1

### Patch Changes

- 4a56e3d: Add generated files to .gitignore to prevent source controlling build artifacts and cache directories

## 0.5.0

### Minor Changes

- e829d40: Test version package flow with minor version bump to verify release workflow.

### Patch Changes

- d48f2bc: Fix release workflow to only publish from Version Packages PR merge, preventing 403 errors from re-publishing already-published versions.

## 0.4.0

### Minor Changes

- cb34a9e: Add Jira skill to the skills manifest for installation via ai-config setup

### Patch Changes

- e6b1210: Fix missing shebang in dist/cli.js causing `sh: ai-config: command not found` when running via npx

## 0.3.0

### Minor Changes

- 4b2702a: Add `agents` topic with `code-style-alphasort` Claude Code subagent
