# Recovery

Read when an agent leaves work half-done or a cleanup deleted something it should not have.

## Stranded PR (agent returned before merging)

Never run two agents on one worktree. The original agent may not be truly dead, and you
cannot `SendMessage` it — verify it is actually gone before dispatching a finisher, and have the
finisher re-fetch + `--force-with-lease` defensively rather than assume exclusive worktree
access. Better: prevent it via ticket-worker's merge discipline.

## Deleted `assets/*` orphan branch

Recoverable while its objects survive GC: worktrees share the main repo's object DB, so run
`git fsck --lost-found`, `git ls-tree` the dangling commits for the asset filename, and push the
found SHA back to the branch name.

When verifying asset URLs on a private repo, anonymous `curl` always 404s even for healthy
branches — check via `gh api repos/{owner}/{repo}/contents/<file>?ref=<branch>` instead.
