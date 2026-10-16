---
name: progress-tracker
description: Use when the user asks for a progress tracker, build tracker, or live progress page for the work in this session, or invokes /progress-tracker. Creates this session's own live tracker artifact (or updates the one this session already made) and keeps its steps, active task and log current as implementation proceeds.
---

# Progress Tracker

A live artifact the user watches (often from their phone) while you build. The page is
static; all content lives in the artifact's `db`, so updates are `ArtifactData` writes,
never republishes.

## One tracker per session

- **This session already published a tracker** → keep updating that one (same URL).
- **Otherwise** → create a **new** tracker from `template.html`.
- **Never reuse a tracker from another session or an earlier conversation** (including
  ones named in project memories) unless the user explicitly says to and gives or names it.
  If they do, `Artifact read` it first, then reset its data (see Reset).

## Create

1. Load the `artifact-capabilities` skill (required before passing `capabilities`).
2. Copy `~/.claude/skills/progress-tracker/template.html` to the session scratchpad as
   `progress-tracker.html`. Replace `__STAGE__` (small eyebrow, e.g. "Acme App · Checkout
   Flow") and `__PHASE__` (heading, e.g. "Build"), and set `<title>` to a 2–4 word name
   for this build.
3. Publish: `Artifact` with that `file_path`, `capabilities: {"db": {}}`, `icon: "checklist"`,
   and a one-sentence `description`. Republishing the same path later updates the same URL.
4. Seed the data in one `ArtifactData` batch (`meta/current` + every `steps/<id>` as `todo`
   + a first log line).
5. Give the user the link.

## Data shape

| Doc | Fields |
|---|---|
| `meta/current` | `stage`, `phase`, `now` (one-line headline of what's happening), `ticket` (optional, see below), `updatedAt` (ms) |
| `steps/<id>` | `order` (int), `title`, `status` (`todo`\|`active`\|`review`\|`done`\|`blocked`), `note`, `model` (e.g. "Sonnet 5.5"), `live` (what the active step is doing right now: "Writing tests", "Review round 2"), `liveAt` (ms), `sub` (optional, see below), `updatedAt` (ms) |
| `log/<id>` | `at` (ms), `text` |

**Ticket** — `meta/current.ticket = {key, url, title}`, e.g.
`{key: "PROJ-142", url: "https://…/browse/PROJ-142", title: "Add order status page"}`.
Set it whenever the work in this session traces to a ticket (Jira, GitHub issue/PR, Linear…)
named in the conversation, branch name, plan, or commits; omit it if there is none — never
invent one. It renders as a link chip under the eyebrow; `url` must be `http(s)`.

**Sub-progress** — `steps/<id>.sub = {done, total, label}` when a step breaks into smaller
pieces (review follow-ups, fix rounds, files to migrate). `done` = finished count, `label` is a
plural noun ("small follow-ups"). The active step's card shows pips and "On 2 of 3 small
follow-ups"; the step row shows `2/3`. Pair it with `live`, e.g. `live: "Approved — working
through review nits"`, `sub: {done: 0, total: 3, label: "small follow-ups"}`. Bump `done` as each
piece lands; drop `sub` (set to `null`) once the step is `done` if the count no longer matters.

Step ids are zero-padded and ordered (`s00`, `s01`, …); log ids ascend (`l0001`, `l0002`, …).
Timestamps are epoch milliseconds (`date +%s000`).

## Updating

- Track **implementation steps only** (plan tasks), not interviewing or planning.
- When a step starts, enters review, finishes, or blocks: update its `status`/`note`/`updatedAt`,
  update `meta/current.now`, and add a log line. Batch these in one `ArtifactData` call.
- At each sub-step of the active step (implementing, testing, reviewing, fix round N), update
  `live` and `liveAt`. When the remaining work is a known count of pieces, set or bump `sub`.
- If a ticket surfaces mid-session (e.g. a PR or issue gets created), add it to `meta/current.ticket`.
- Only one step should be `active` at a time unless work is genuinely parallel.
- Writes to existing docs need `if_version`; on a version conflict, re-read and retry.

## Reset (only when the user explicitly asks to reuse an existing tracker)

Delete the old `steps/*` and `log/*` docs, then seed the new build as in Create step 4.
If its `<title>` doesn't fit the new build, republish its page with an updated title.
