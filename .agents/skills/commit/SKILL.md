---
name: commit
description: Write a commit message in this repo's gitmoji format. Use when composing or amending a commit message, or when asked to commit staged work. Covers gitmoji selection, subject-line shape, and ticket references.
argument-hint: [ticket-number]
allowed-tools: Bash, AskUserQuestion
model: haiku
---

Staged diff:
!`git diff --staged`

Status:
!`git status --short`

Branch:
!`git branch --show-current`

Recent commit tickets:
!`git log --oneline -5 | grep -oE '[A-Z]+-[0-9]+' | head -1`

---

Generate a commit message in the imperative in the following format exactly:

```
<type>(<ticket>): <gitmoji> <Subject line in sentence case>

- <change in prose>
- <change in prose>
```

**Rules:**

- **Type**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, or `build`
- **Ticket**: Determine the ticket using this priority order:
  1. Use `$ARGUMENTS` if provided
  2. Extract from the branch name (e.g. `feature/PROJ-123-description` → `PROJ-123`)
  3. If neither of the above, use `AskUserQuestion` to ask the user for the ticket number. If a ticket was found in the "Recent commit tickets" output above, use it as the default in your question (e.g. "What ticket number? (default: PROJ-123)"). If no recent ticket found, ask without a default.
  4. If the user provides no ticket number when asked, omit the parentheses entirely.
- **Gitmoji**: Pick the single most fitting emoji from gitmoji.dev for the overall changeset. Common mappings:
  - ✨ new feature · 🐛 bug fix · ♻️ refactor · 📝 docs · 🎨 code structure
  - 🔧 config · 🚀 deploy · ✅ tests · 💄 UI/style · ⬆️ upgrade deps
  - 🔥 remove code · 💥 breaking change · 🐳 Docker · 🙈 gitignore · 🧪 failing test
  - 🏗️ architecture · 📦 packages · 🔒 security · 🌐 i18n · ⏪ revert
- **Subject**: Sentence case, imperative mood, no trailing period. Entire header line ≤ 120 chars.
- **Body**: Unordered list of individual changes in plain prose. Omit body if the subject fully captures everything.

After determining the ticket (including asking if necessary), commit immediately using:
```bash
git commit -m "$(cat <<'EOF'
<message here>
EOF
)"
```
