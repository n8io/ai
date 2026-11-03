---
"@n8io/ai": patch
---

ship: bedtime preflight also collects every credential a ticket's outward action needs (CLI login scopes such as `gh` `workflow`, tokens a created repo needs), so workers never stop mid-run for a login.
