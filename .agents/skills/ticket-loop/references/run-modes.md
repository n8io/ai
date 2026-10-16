# Ticket-loop run modes

Read this only when the user asks for one of these modes at preflight. The default run is PRs
into `main` with remote CI running once per PR.

## CI-disabled run

- **CI-DISABLED RUN MODE (user may request it to save GitHub Action minutes; it's a stop-gap,
  not best practice).** When the user says "don't run CI / verify locally first", the pattern is:
  (a) every worker commit carries `[skip ci]` so GitHub burns zero Action minutes; (b) the worker
  runs the FULL local CI-equivalent (`pnpm run ci` for the validate job + the integration suite)
  ONCE before pushing — that local run IS the CI substitute, so bake it into the kickoff as a hard
  gate. Tell the worker the integration gate needs the repo's documented SERVICE STACK up (e.g.
  the local S3 store) and name the current passing baseline count — a worker without the stack
  reads its env failures as "pre-existing" and merges on a short count; (c) merge via `gh pr merge --admin` because the required status checks (`validate`/
  `integration`) never report and the ruleset would otherwise block forever — confirm `--admin`
  is permitted (repo admin + the `gh pr merge` allow rule covers it) BEFORE the run; (d) THE
  ORCHESTRATOR runs a cheap per-ticket sanity check on `main` between tickets (e.g. `pnpm
  typecheck`), because with CI off `main` can silently go RED and the next worker branches from it.
  This is not paranoia — a ticket can merge with a red typecheck that only the next worker's
  local `pnpm run ci` catches. State the mode in your first
  status line and confirm the merge tension (required checks vs no CI) with the user before Step 2.
  - **Env-blocked integration gate: the orchestrator may clear it, but only after verifying BOTH
    halves itself.** When a worker reports the integration suite cannot run at all (harness/env
    failure, not test failures) and that it reproduces on clean `main`, do not make it park
    forever — but do not take the claim on faith either. Verify by REST (`gh api .../pulls/<n>/files`)
    that the ENTIRE diff lies outside the integration-covered layer (for this repo: nothing under
    `src/contexts/`), and that `pnpm run ci` was green. Both hold → send an orchestrator GO,
    labelled as yours, and have the env-block + rationale noted in the PR body. Either fails →
    the gate stands; fix the env or escalate. Flag the env-block at loop end regardless: the next
    ticket that DOES touch the covered layer cannot merge honestly until the harness runs.
  - **`[ci skip]` convention + broken local harness + a contexts/migration diff = a USER
    decision, not an orchestrator auto-clear.** This repo HAS CI workflows (`ci.yml`:
    `validate` + a sharded `integration` job), but the standing `[ci skip]`-on-every-commit
    convention makes GitHub SKIP them — which is why `statusCheckRollup` reads empty, `--admin`
    is the merge path, and it can look like "no CI". When a ticket touches `src/contexts/` + adds
    a migration AND the local integration harness is broken on the machine, integration is then
    verified by NEITHER path (remote skipped, local broken), and because the diff is INSIDE the
    covered layer you may NOT auto-clear it. Surface it to the user via AskUserQuestion with the
    three real options: (a) drop `[ci skip]` on this PR so CI runs `integration` remotely as the
    gate; (b) fix the local harness, run the suite locally once, keep `[ci skip]`, merge
    `--admin`; (c) merge on unit-only with integration deferred (discourage for a contexts
    change). A worker that opens this question in-session is double-asking — tell it to withdraw
    and route through you. If the fix is a genuine harness bug (e.g. the globalSetup template
    clone racing its own eager DB pool), it is FOLDABLE into the PR and helps every future
    contexts ticket.

## Branch-based modes

- **NO-PR / FEATURE-BRANCH MODE (user may choose it when the backlog refines an UNMERGED feature
  branch, not `main`).** When the tickets refine code that lives only on a staging/feature branch
  (e.g. a large feature pushed as backup, not yet merged — verify with `git rev-list --count
  origin/main..<branch>`), the standard PR-into-main flow is wrong: a worker branching from `main`
  would lack the feature code. Confirm the merge model with the user UP FRONT (the skill's
  push/poll probe is orthogonal to this). In no-PR mode the kickoff replaces the PR/Copilot/merge
  block with: (a) `git fetch origin`, then `git worktree add … -b issue-<n> origin/<feature-branch>`
  (NOT `main`); (b) land work by pushing straight onto the shared branch after each commit — `git
  push origin HEAD:<feature-branch>` (fast-forward because serial + branched from its tip; on a
  non-ff rejection, `git fetch` then `git rebase origin/<feature-branch>` and re-push); (c) NEVER
  push to `main` if it deploys; (d) no PR, no Copilot loop, no squash-merge. The review gate is the
  ticket's OWN process (TDD + a task review per change + whole-branch review), not a PR. Harvest by
  the worker's DONE report (there is no branch-gone/merge signal to watch); a ticket often stays
  OPEN because its verification is deferred (see below) — that is honest, not a failed run. The
  orchestrator can commit design specs to the feature branch itself between workers (fast-forward
  its own worktree first) when no worker is live. Evidence: the 2026-09-22 closures run — #4/#5/#6
  and a from-scratch design ticket #9 all built and pushed to one unmerged branch, no PRs, clean.
- **RELEASE-BRANCH CHAIN MODE (user may choose it when some tickets must not reach a deploying
  `main` yet, e.g. a server change that has to ship with a matching app release).** Create ONE
  integration branch off `main` (REST: `gh api -X POST repos/{owner}/{repo}/git/refs -f
  ref=refs/heads/<release-branch> -f sha=<main sha>`), and land the held ticket plus EVERY ticket
  that depends on it there, via normal PRs whose base is that branch. The kickoff says: branch
  the worktree from `origin/<release-branch>`; open the PR with that base; never push to or
  open a PR against `main`; write NO closing keyword (GitHub auto-closes only on the default
  branch, and the issue must stay open until the release); leave the issue open with a comment
  linking the PR. At harvest, swap the `in-progress` label for an `on-release-branch` label.
  Native "blocked by" counts stay above 0 while the held ticket is open, so pick the chain order
  by hand. Tickets that are safe for `main` still go straight to `main`; ask the user whether to
  run those first. The last ticket runs a whole-branch build/test/lint check on the release
  branch. At loop end, leave a release checklist (migrations riding along, back-compat notes,
  issues to close by hand). Evidence: the 2026-09-24 snow-day ux-audit run landed 8 tickets and
  3 migrations on `ux-audit-release` with `main` untouched, while 5 main-safe tickets merged.
