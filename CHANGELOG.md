# @n8io/ai-config

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
