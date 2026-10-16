---
name: pr-title
description: Use this agent to generate and apply a PR title in gitmoji format. Invoke when creating or updating a pull request title based on the branch's commits and changes.
model: haiku
---

Branch:
!`git branch --show-current`

Commits on this branch:
!`git log --oneline $(git merge-base HEAD main)..HEAD`

Diff stat:
!`git diff $(git merge-base HEAD main)...HEAD --stat`

---

Generate a PR title in the imperative in the following format exactly:

```
<type>(<ticket>): <gitmoji> <Subject line in sentence case>
```

**Rules:**

- **Type**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, or `build`
- **Ticket**: Try to extract from context or the branch name (e.g. `feature/PROJ-123-description` → `PROJ-123`). If no ticket found, omit the parentheses entirely.
- **Gitmoji**: Pick the single most fitting emoji from gitmoji.dev for the overall changeset. Common mappings:
  - ✨ new feature · 🐛 bug fix · ♻️ refactor · 📝 docs · 🎨 code structure
  - 🔧 config · 🚀 deploy · ✅ tests · 💄 UI/style · ⬆️ upgrade deps
  - 🔥 remove code · 💥 breaking change · 🐳 Docker · 🙈 gitignore · 🧪 failing test
  - 🏗️ architecture · 📦 packages · 🔒 security · 🌐 i18n · ⏪ revert
- **Subject**: Sentence case, imperative mood, no trailing period. Entire title ≤ 72 chars.

Apply the title immediately:
- If a PR already exists for this branch: `gh pr edit --title "<title>"`
- Otherwise: `gh pr create --title "<title>" --body "" --draft`
