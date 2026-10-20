---
"@n8io/ai": patch
---

ship: collect typed approvals for steps auto mode blocks (always-on services, global installs, secret files, outside services) before dispatch, and in Projects mode check `gh auth` on threads that run on the user's own machine, where the GitHub MCP tools are absent.
