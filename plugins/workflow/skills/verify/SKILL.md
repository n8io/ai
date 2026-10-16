---
name: verify
description: Use when bootstrapping or refreshing the AGENTS.md `## Verify` section (test, fmt, lint, typecheck commands), or when the user runs /verify.
allowed-tools: Bash, Read, Write, Edit, AskUserQuestion
---

# /verify — write a `## Verify` section into AGENTS.md

Goal: produce a terse, token-cheap `## Verify` section in `<cwd>/AGENTS.md` so any coding agent (Claude Code, Cursor, Codex, Copilot) can run the right commands to verify pristine state without parsing prose.

---

## Detection signals

Project root listing:
!`ls -1a 2>/dev/null | head -60`

Lockfiles present:
!`ls -1 pnpm-lock.yaml yarn.lock bun.lockb package-lock.json 2>/dev/null || true`

Lockfile mtimes (newest wins on ties):
!`stat -f '%m %N' pnpm-lock.yaml yarn.lock bun.lockb package-lock.json 2>/dev/null | sort -rn || true`

Existing AGENTS.md (if any):
!`test -f AGENTS.md && cat AGENTS.md || echo "(no AGENTS.md)"`

package.json scripts (if Node):
!`test -f package.json && (command -v jq >/dev/null && jq -r '.scripts // {} | to_entries[] | "  " + .key + ": " + .value' package.json || sed -n '/"scripts"/,/}/p' package.json) || echo "(no package.json)"`

pyproject.toml (if Python):
!`test -f pyproject.toml && head -120 pyproject.toml || echo "(no pyproject.toml)"`

Cargo.toml (if Rust):
!`test -f Cargo.toml && head -60 Cargo.toml || echo "(no Cargo.toml)"`

go.mod (if Go):
!`test -f go.mod && cat go.mod || echo "(no go.mod)"`

Makefile targets:
!`test -f Makefile && grep -E '^[a-zA-Z_-]+:' Makefile | head -40 || echo "(no Makefile)"`

justfile recipes:
!`test -f justfile && grep -E '^[a-zA-Z_-]+:' justfile | head -40 || echo "(no justfile)"`

---

## Step 1 — Pick the package manager (Node only)

If multiple Node lockfiles exist, pick the one with the newest mtime. Mapping:

| Lockfile | Manager |
|---|---|
| `pnpm-lock.yaml` | `pnpm` |
| `yarn.lock` | `yarn` |
| `bun.lockb` | `bun` |
| `package-lock.json` | `npm` |

If both Node and a non-Node stack signal exist, pick the dominant one based on what most files belong to. Surface ambiguity in the interview.

## Step 2 — Build a draft per category

Walk these categories: **test**, **fmt**, **lint**, **typecheck**. For each, derive a default `all` command and (when supported) a `narrow` command. If a category has no signal at all, set its draft to `<unknown>`.

### Node

From `package.json` `scripts`, match by name pattern (case-insensitive):

| Script name pattern | Category |
|---|---|
| `test`, `test:*` | test |
| `lint`, `lint:*` | lint |
| `format`, `fmt`, `prettier`, `format:*` | fmt |
| `typecheck`, `type-check`, `tsc`, `typecheck:*` | typecheck |

The `all` command is `<pm> <script-name>`. Prefer the script named exactly `test`/`lint`/`format`/`typecheck` when present; otherwise pick the most generic-looking variant.

Narrowing — apply the lookup table in the **Narrowing** section below using the underlying tool (inferred from the script body or from installed devDependencies).

### Python

Detect from `pyproject.toml`:
- `[tool.pytest]` or `pytest` in deps → test = `pytest`, narrow = `pytest <file>::<test>` and `pytest -k <pattern>`
- `[tool.ruff]` or `ruff` in deps → fmt = `ruff format .`, narrow = `ruff format <files>`; lint = `ruff check .`, narrow = `ruff check <files>` and `ruff check $(git diff --name-only HEAD)`
- `[tool.mypy]` or `mypy` in deps → typecheck = `mypy .`, narrow = `mypy <path>`
- `pyright` in deps → typecheck = `pyright`, narrow = `pyright <files>`

### Rust

`cargo test`, `cargo fmt`, `cargo clippy --all-targets -- -D warnings`, `cargo check --all-targets`. Narrowing per the table.

### Go

`go test ./...`, `gofmt -w .`, `go vet ./...`, `go build ./...`. Go has no separate typecheck step — `go vet` doubles. Narrowing per the table.

### Makefile / justfile overrides

If `Makefile` or `justfile` defines targets named `test`, `lint`, `fmt`/`format`, `typecheck` (case-insensitive), those override whatever you derived above for that category. The `all` command becomes `make <target>` or `just <target>`. Narrowing usually doesn't apply to wrapped targets — set narrow to skipped unless the user provides one.

## Narrowing lookup

Only apply narrow patterns from this table. If the tool isn't listed, leave narrow unset.

| Tool | Narrow pattern(s) |
|---|---|
| vitest | `vitest run <file>`, `vitest run -t <pattern>` |
| jest | `jest <file>`, `jest -t <pattern>` |
| pytest | `pytest <file>::<test>`, `pytest -k <pattern>` |
| prettier | `prettier --write <files>` |
| eslint | `eslint <files>`; diff variant: `eslint $(git diff --name-only HEAD)` |
| ruff (lint) | `ruff check <files>`; diff variant: `ruff check $(git diff --name-only HEAD)` |
| ruff (fmt) | `ruff format <files>` |
| tsc | `tsc --noEmit -p <tsconfig>` (TS narrows by tsconfig, not file) |
| mypy / pyright | `<tool> <path>` |
| cargo test | `cargo test <name>` |
| cargo clippy | `cargo clippy -p <pkg>` |
| go test | `go test ./<pkg>/...`, `go test -run <regex>` |
| gofmt | `gofmt -w <files>` |
| go vet | `go vet ./<pkg>/...` |

## Step 3 — Show draft, then interview

Print the draft section to the user as a single fenced markdown block so they can see what's about to be confirmed. Example:

```markdown
## Verify

run before done. narrow when can.

- test all: `pnpm test`
- test one: `pnpm test <file>`
- fmt all: `pnpm format`
- fmt files: `pnpm prettier --write <files>`
- lint all: `pnpm lint`
- lint diff: `pnpm lint $(git diff --name-only HEAD)`
- typecheck all: `pnpm tsc --noEmit`
- typecheck pkg: `pnpm tsc --noEmit -p <tsconfig>`
```

Then walk **one `AskUserQuestion` per line** in the draft. Each question must offer three options:

- `accept` — keep the line as drafted
- `edit` — user provides a replacement command (single string)
- `skip` — omit this line from the final section

Use the question prompt to show both the label (e.g., `test all`) and the drafted command so the user has full context. For `<unknown>` lines, the same three options apply — `edit` lets the user fill it in.

Do NOT batch the interview into one mega-question. One line, one question. The user answers, you move to the next.

## Step 4 — Render and write

After the interview, render the final section. Skip lines the user marked `skip`. If every category was skipped, tell the user nothing usable was confirmed and exit without writing.

The block always opens with:

```
## Verify

run before done. narrow when can.

```

Followed by the kept lines in this order: `test all`, `test one|narrow`, `fmt all`, `fmt files|narrow`, `lint all`, `lint diff|narrow`, `typecheck all`, `typecheck pkg|narrow`. Use the labels you presented in the draft (e.g., if narrowing for tests is by pattern, label it `test pattern` instead of `test one`).

### Write rules

Operate on `<cwd>/AGENTS.md`:

| State | Action |
|---|---|
| File missing | Create it, content = the rendered section. |
| File exists, no `^## Verify\s*$` line | Append section at end, with one blank line of separation. |
| File exists, has `^## Verify\s*$` line | Replace from that header up to (but not including) the next `^## ` header or EOF. Leave the rest of the file untouched. |

Section detection MUST be a line-anchored regex match: `^## Verify\s*$`. Do not match `### Verify` or `## verify-something`.

Use the `Edit` tool when the file exists and the section is being replaced. Use `Write` only when creating a new file or appending. Read the file first if it exists.

## Step 5 — Report

After writing, print the final block back to the user inside a fenced code block, followed by exactly one footer line:

```
AGENTS.md updated — review and commit when ready.
```

Do NOT run any git command. No `git add`, no `git diff`, no `git status`. Committing is the user's job.

## Edge cases

- **Empty repo / nothing detected**: tell the user no tooling was detected, suggest re-running after they've added test/lint/fmt/typecheck setup, exit without writing.
- **Multiple Node lockfiles**: pick newest mtime for the draft, surface the choice in the first relevant interview prompt so the user can correct.
- **Cross-language repos** (e.g., Python service + Go cli in one repo): pick the dominant language by file presence; user can edit individual lines during the interview.
- **`<cwd>/AGENTS.md` is a symlink**: follow it and edit the target file. Don't replace the symlink.
- **Existing `## Verify` section has user-added lines we don't recognize**: they get replaced. The section is owned by this skill. Users wanting bespoke verification commands should put them under a different header.
