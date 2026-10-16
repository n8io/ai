---
name: jira
description: Use when a JIRA ticket ID (e.g. PROJ-123, ABC-456) is mentioned and the user needs ticket context, or when explicitly invoked with /jira <ticket-id>.
---

# JIRA Ticket Context

Fetch JIRA ticket details, comments, and attachments via `jcfa` in Docker.

## Setup

```bash
docker image inspect jcfa:latest >/dev/null 2>&1 || docker build -t jcfa:latest "${CLAUDE_SKILL_DIR}"
```

`${CLAUDE_SKILL_DIR}` is this skill's directory (it holds the Dockerfile); outside Claude Code use that path.

If `$HOME/.jcfa/` does not exist (or auth has expired), the user must run first-time auth setup **in their own terminal** (interactive):

```
docker run -it --rm -v "$HOME/.jcfa:/root/.jcfa" jcfa:latest configure
```

Wait for the user to confirm before proceeding.

## Run pattern

Every command below runs as:

```bash
docker run --rm -v "$HOME/.jcfa:/root/.jcfa" jcfa:latest <command>
```

For downloads, add a second mount: `-v "/tmp/jira/<TICKET-ID>:/tmp/jira/<TICKET-ID>"`. Always quote mount paths.

| Action | Command |
|---|---|
| Get issue | `jcfa get TICKET-ID --full --json` |
| List attachments | `jcfa attachment list TICKET-ID --json` |
| Download attachment | `jcfa attachment download TICKET-ID FILE --output /tmp/jira/TICKET-ID/` |
| Reconfigure auth | `jcfa configure` (interactive, user's terminal) |

## Sequence

1. **Get issue** — parse summary, description, status, assignee, priority, labels, linked issues, subtasks, comments (author + timestamp).
2. **Attachments** — list, then download all non-`video/*` files to `/tmp/jira/<TICKET-ID>/` (`mkdir -p` first). Report failures, continue with the rest. No attachments → skip.
3. **Present** — issue summary, description, comments, downloaded file paths.
4. **Images** — if any were downloaded, ask which to view inline and display via the Read tool.

## Errors

- **Ticket not found** — wrong ID or missing permissions; tell the user.
- **Auth expired** — user re-runs the `configure` command above in their own terminal.
