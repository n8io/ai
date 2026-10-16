# Ticket selection and claiming

Shared by `next-issue`, `ticket-loop` and `parallel-tickets`. Fix selection rules here, once.

## List open issues (REST)

Use REST. It carries dependency counts, which `gh issue list --json` does not, and the GraphQL
quota is often already exhausted at session start.

```bash
gh api -X GET repos/{owner}/{repo}/issues --field state=open --field per_page=50 \
  --jq 'sort_by(.created_at) | .[] | select(.pull_request == null) | {number, title, labels: [.labels[].name], blockedBy: (.issue_dependencies_summary.blocked_by // 0)}'
```

## Rank

1. Highest priority label first: `P0` > `P1` > `P2` > `P3` > unlabeled.
2. Same priority: a bug before a feature.
3. Then oldest first.

## Exclude

- **Labeled `in-progress`.** Another agent holds it.
- **Has an open linked PR.** Check with `gh issue view <n> --json closedByPullRequestsReferences`
  or `gh pr list --search "<n> in:body"`.
- **Has an open blocker** (`blockedBy` above 0). A blocked high-ranked issue usually means its
  blocker is the right pick. List blockers with
  `gh api repos/{owner}/{repo}/issues/<n>/dependencies/blocked_by --jq '[.[] | select(.state=="open") | .number]'`.
- **Held by a live sibling session.** A locked worktree for the issue plus a live agent means it
  is taken, even if the label is missing.
- **Blocked on the user.** The ticket needs something only the user can produce: a production
  query result, a dry-run someone must review, an architecture call. The body usually says so
  ("once X is reviewed", a SQL query to run). Skip it and report the reason once per run, not
  every iteration. Offer a `blocked` label so later runs skip it for free. Before skipping a
  ticket you remember as blocked, spend one REST body read to confirm it still is; a re-groom
  can make it ready.

## Notice siblings

If the candidate has 2+ siblings that are the same job on different sites (same root cause,
same fix shape), dispatch them as ONE scoped ticket rather than serially. Four tickets for one
sweep is backlog churn, not thoroughness.

## Nothing ready

Report the next ticket that needs grooming (`idea-to-tickets` can groom it) and stop.

## Claim before any work starts

Claim immediately on selection, before spawning or branching, so no other agent picks it.

```bash
gh api -X POST repos/{owner}/{repo}/labels -f name=in-progress -f color=FBCA04 \
  -f description="Actively being worked on by an agent" >/dev/null 2>&1   # ignore "already exists"
gh api -X POST repos/{owner}/{repo}/issues/<n>/labels -f "labels[]=in-progress"
```

Release on abort or after merge, even if the merge auto-closed the issue:

```bash
gh api -X DELETE repos/{owner}/{repo}/issues/<n>/labels/in-progress
```

Never leave a stale claim.
