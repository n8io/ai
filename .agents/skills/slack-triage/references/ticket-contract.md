# Ticket contract

Read at step 5 of SKILL.md. Each ticket body has exactly these sections, in this order:

```markdown
**Reported by** First Last in Slack — <canonical permalink>

**Observed**
What the user saw, quoted. Their words, not your paraphrase.

**From the screenshot**
The image itself, embedded, then the facts you read off it: error text, route,
viewport. Omit if no image.

**From telemetry**
Facts read from the matching error-tracker event or log: error text, stack frame,
release, browser. Omit if none.

**Scope**
What the report does and does not cover. Which surfaces are confirmed
affected, and which were confirmed fine.

**Where this appears to live**
`path/to/file.ts:42` — one line on why this file. Locate; do not solve.

**Unverified**
Reporter theories and hearsay, quarantined and labelled as such.

**Open questions**
What must be answered before anyone can groom this.
```
