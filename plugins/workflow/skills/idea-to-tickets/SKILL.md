---
name: idea-to-tickets
description: Use when the user has an idea, feature, bug or epic in their own words that should become groomed, implementation-ready GitHub issues with priorities and a dependency graph, before any building starts. For a Slack thread or permalink use slack-triage instead.
---

# Idea to Tickets

Turn an idea into **filed, groomed, ready tickets** that `next-issue`, `ticket-loop` and
`parallel-tickets` can pick up without asking anything. The output is a dependency graph of
issues, not code.

Ends at filed tickets. Do not start implementing.

## 1. Grill

Interview the user down every branch of the design, one question at a time, with your
recommended answer for each, always with `grill-with-docs`: it challenges terms against
`CONTEXT.md` and records each settled term there as it happens (creating the file and its
`AGENTS.md` import if missing). If the code can answer a question, read the code instead of asking.

- Settle scope edges explicitly: what is in, what is out, what is deferred and why.
- Keep going until a worker could build every ticket without a clarifying question.

## 2. Prototype visual work

For any UI or UX change, show options before ticketing, using whatever the repo's memory says
(a published HTML artifact with the options switchable on one page, or screenshots of the real app with fake data; never the Design canvas type). Get a pick. The pick
becomes a settled decision in the ticket.

## 3. Verify premises

Grep every factual claim you are about to write into a ticket: counts, field names, file lists,
"only caller", "unused". They are routinely wrong. Record what the code actually shows.

Save what you learned exploring as a **context pack** at
`<main checkout>/.agents/scratchpad/context/<slug>.md`: relevant files and why, patterns and
helpers to follow, test layout and commands, gotchas, an `## External hosts` list (every host
the work reaches at build or test time, so the environment can be checked first), and an empty
`## Findings` section.
Each ticket body points at it so workers start from it instead of re-exploring.

## 4. Decompose into a dependency graph

Split the work so as much as possible can run in parallel.

- **One ticket = one reviewable PR.** Give each a rough size in production lines. Estimate
  tests separately; fixtures, snapshots and generated files count toward neither.
- **Contract first.** When several tickets share a new interface (types, API shapes, events,
  schema or migrations), put that interface alone in a first ticket. Everything that consumes it
  is blocked by it and nothing else, so it can fan out the moment the contract merges.
- **Owned files.** Each ticket lists the files or directories it will change. Two tickets that
  could run at the same time must not own the same file. If they would, either add a
  dependency between them or move the shared edit into the contract ticket.
- **Real dependencies only.** Ticket B is blocked by A only if B needs A's merged code. Do not
  chain tickets just to order them; ordering is the scheduler's job.
- **Fold siblings.** Same root cause and same fix shape across several sites is one ticket.
- **Bug before feature** at the same priority.
- An epic gets a parent issue; its tickets become sub-issues.

Draw the graph as a Mermaid flowchart (contract at the top, arrows from blocker to blocked) and
mark the tickets that are ready immediately.

## 5. Draft each ticket

Each body has these sections, in order:

```markdown
**Why**
One or two sentences on the user-facing reason.

**Scope**
In, out, and deferred (with why).

**Settled decisions**
Every answer from the grilling and the prototype pick that applies here. Workers treat these as final.

**Terms**
The `CONTEXT.md` terms this ticket uses or adds. Name things in code with exactly these.

**Owned files**
`path/or/dir` — one line on why. Workers stay inside these unless the code proves otherwise.

**Interfaces**
Provides: what this ticket defines for others. Consumes: what it relies on, and which ticket provides it.

**Acceptance**
Observable checks a reviewer can run.

**Size**
~N files / ~M production lines; tests ~T lines (fixtures, snapshots, generated files excluded).

**Context pack**
`.agents/scratchpad/context/<slug>.md`
```

No "Open questions" section on a ready ticket. If one has an open question, it is not ready:
go back to step 1, or file it labeled `needs grooming`.

## 6. Groom with the user, then file

Show the graph and every draft. Walk scope, priorities and the dependency edges in product
language, not implementation language. File only on an explicit yes; filing is visible and
hard to undo.

Labels: a priority (`P0`–`P3`) on every ticket, plus the repo's kind label (`bug`, `feature`)
if it has one. Check each label exists first (`gh label list`, or `get_label` over MCP); a
missing one fails the filing. Create it if you can (`gh label create`); over MCP, which cannot
create labels, file without it and ask the user to add it.

```bash
gh issue create --title "…" --body-file <draft>.md --label P1 --label feature
```

Then link the graph with REST. Both endpoints take the other issue's numeric `id`, not its number:

```bash
id() { gh api repos/{owner}/{repo}/issues/$1 --jq .id; }
# B is blocked by A
gh api -X POST repos/{owner}/{repo}/issues/<B>/dependencies/blocked_by -F issue_id="$(id <A>)"
# ticket T is a sub-issue of epic E
gh api -X POST repos/{owner}/{repo}/issues/<E>/sub_issues -F sub_issue_id="$(id <T>)"
```

Verify with `gh api repos/{owner}/{repo}/issues/<B>/dependencies/blocked_by --jq '.[].number'`.

## 7. Report

One short message: the Mermaid graph with real issue numbers, which tickets are ready now, and
a suggested dispatch (`parallel-tickets` when the ready set has disjoint owned files, otherwise
`ticket-loop`).
