# n8io/ai

A Claude Code plugin marketplace named `n8io`. It has two plugins and a small bootstrap script.

- `workflow`: skills and subagents for going from an idea to a merged PR. Works in any Agent Plugins client.
- `tools`: Claude Code only. Helper commands on PATH, safety hooks, and the gh-events watcher. Needs `workflow`.

## Install in Claude Code

```
/plugin marketplace add anthropics/claude-plugins-official
/plugin marketplace add n8io/ai
/plugin install workflow@n8io
/plugin install tools@n8io
```

`workflow` depends on `superpowers@claude-plugins-official`, so add the official marketplace first.

## Other agents

Skills follow the Agent Skills format, so any agent that reads `.agents/skills/` can use them:

```
npx skills add n8io/ai
```

## Bootstrap

Plugins do not cover your global rules, the statusline or settings. `setup/bootstrap.sh` does. Run it from a clone of this repo:

```
bash setup/bootstrap.sh            # set everything up
bash setup/bootstrap.sh --dry-run  # print what it would do
```

It is safe to re-run and never prompts. It will:

1. Add the `claude-plugins-official` and `n8io` marketplaces and install both plugins.
2. Link `AGENTS.md` and `statusline-command.sh` into your Claude config dir (also `~/.cursor` and `~/.codex` if they exist).
3. Merge `setup/settings.json` into `settings.json`. It adds missing keys and list entries only, never overwrites yours, never touches `hooks`.
4. Link the `workflow` skills into `~/.agents/skills`.

It respects `CLAUDE_CONFIG_DIR`. Set `N8IO_MARKETPLACE_SOURCE` to use a local path instead of `n8io/ai`.

## Cloud environments

In a claude.ai/code environment, paste this into the setup script field:

```bash
tmp="$(mktemp -d)"
git clone --depth 1 https://github.com/n8io/ai "$tmp/ai"
bash "$tmp/ai/setup/bootstrap.sh" --cloud
```

`setup/cloud-setup.sh` is the same thing with cleanup. `--cloud` copies files instead of linking and skips the `~/.agents/skills` links. If the `claude` CLI is missing it still copies the rules and statusline and merges settings from the clone.

## What is in each plugin

`workflow` skills: `commit`, `idea-to-tickets`, `jira`, `next-issue`, `parallel-tickets`, `progress-tracker`, `ship`, `slack`, `slack-triage`, `stack-notes`, `ticket-loop`, `ticket-worker`, `verify`. Agents: `pr-title`, `code-style-alphasort`.

`tools`:

- Commands: `cs` (session launcher), `gh-wait`, `gh-events`, `glossary-check`, `skill-budget`, `skills-check`, `slack-download`.
- Hooks: a worktree path guard (Write, Edit, NotebookEdit) and `tool-guard.sh` (Bash, Write, Edit).
- Skill: `gh-events`, backed by the app in `plugins/tools/lib/gh-events`.

## Development

```
claude plugin validate --strict .                 # marketplace
claude plugin validate --strict plugins/workflow
claude plugin validate --strict plugins/tools
bun test                                          # gh-events and tool-guard tests
bash -n setup/*.sh plugins/tools/hooks/*.sh       # shell syntax
bash plugins/tools/bin/skill-budget               # skill size budgets
```

Try it without touching your real config:

```
export HOME="$(mktemp -d)" CLAUDE_CONFIG_DIR="$(mktemp -d)"
N8IO_MARKETPLACE_SOURCE="$PWD" bash setup/bootstrap.sh
```

Every PR needs a changeset (`bunx changeset`). Merging to `main` opens a Version Packages PR. That PR runs `scripts/sync-versions.sh`, which writes the version into all four plugin manifests (`.claude-plugin/plugin.json` and `plugin.json` in each plugin). Merging it tags `workflow--v<version>` and `tools--v<version>` and creates a GitHub release. Nothing is published to npm.
