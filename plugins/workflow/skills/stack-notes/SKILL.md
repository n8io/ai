---
name: stack-notes
description: Use when a step needs stack-specific know-how — activating a runtime, installing dependencies, setting up a worktree, generating code or migrations, recording browser evidence, sizing a PR with generated files. Holds per-language and per-tool lessons so the workflow skills stay language-agnostic.
---

# Stack Notes

The workflow skills (`ship`, `ticket-worker`, `next-issue`, …) name work by role: "the repo's
test command", "the toolchain gate", "generated files". This skill holds what those roles mean
for a particular language or tool.

## Use

1. Find the repo's stacks: its `AGENTS.md` (a `## Stack` line or its `## Verify` commands), then
   the manifests at the root (`package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, …).
2. Read only the reference file for each stack the repo uses. Skip the rest.
3. The repo's own `AGENTS.md` and memory win over these notes.

## References

- [node.md](references/node.md) — Node, TypeScript, pnpm/bun, Vite
- [drizzle.md](references/drizzle.md) — Drizzle ORM migrations
- [playwright.md](references/playwright.md) — browser recordings and screenshots from a worktree
- [python.md](references/python.md) — Python, uv

No file for a stack means no known lessons yet. When a run teaches one, create
`references/<stack>.md` and add it to this list. Each file stays under 350 lines.

## What belongs here

A lesson that holds for every repo on that stack. A lesson about one repo goes in that repo's
memory or `AGENTS.md`. A lesson about every stack goes in the workflow skill itself.
