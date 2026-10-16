---
"@n8io/ai": major
---

Remove the `ai-config` npm installer and its symlink topics. The repo is now the `n8io` Claude Code plugin marketplace with two plugins, `workflow` (skills and subagents) and `tools` (helper CLIs on PATH, safety hooks, the gh-events watcher). `setup/bootstrap.sh` installs both and sets up the global rules, statusline and baseline settings. Other agents install the skills with `npx skills add n8io/ai`. Releases tag each plugin as `workflow--v<version>` and `tools--v<version>` instead of publishing to npm.
