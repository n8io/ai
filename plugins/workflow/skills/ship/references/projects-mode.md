# Projects mode (claude.ai Projects cloud threads)

Use this mode when the session is a thread of a claude.ai Project: `CLAUDE_CODE_PROJECTS_SESSION`
is set, or the thread tools (`reply`, `update_status`) are loaded. There is no `gh` login,
`tmux`, Claude in Chrome, Remote Control or cross-session `SendMessage`/`ListAgents`. GitHub goes
through the GitHub MCP tools (`mcp__github__*`) only. Each rule below replaces the local
mechanism named in `ship` or `ticket-worker`; everything else in those skills still applies.

## Orchestrator (ship)

- **Preflight.** Skip `cs`, `tmux`, the messaging socket and `ListAgents`. Confirm
  `mcp__github__get_me` works, and run the environment preflight (ship step 3) from this thread.
- **Review bot.** Check once whether the repo has a review bot: read the reviews on its two most
  recent merged PRs (`pull_request_read`). Record `Review bot: copilot | none` in the context
  pack. Workers run the Copilot loop only when it says `copilot`.
- **Dispatch.** One thread per ticket instead of a tmux worker. The kickoff (same template, mode
  `projects`) is the thread's first message; the project's channel session or the user starts
  the thread. Claim the ticket before it starts: `issue_write` with `in-progress` added (its
  `labels` replaces the whole list, so pass the existing labels too).
- **Progress.** Thread checklists and thread cards replace the progress tracker. Do not create or
  update a tracker artifact. Read state with `list_thread_sessions` (`status_bucket`) and
  `fetch_thread`, not by asking workers to report.
- **Questions.** A worker asks the user in its own thread (`ask_decision` card). Questions you
  can settle before dispatch still go in the kickoff as settled decisions.
- **Harvest.** A merged PR (`list_project_prs` or the issue state) plus a finished checklist is the
  Finished report. No wrap-up handshake, idle check or kill.
- **Gotchas.** Do not load `../../ticket-loop/references/orchestrator-gotchas.md`; it is about
  tmux, panes and messaging. Read a section only if a symptom it names shows up.

## Worker (ticket-worker)

- **Mode `projects`.** Ask the user directly in your thread with `ask_decision` and end the turn;
  the answer wakes you. Never call `SendMessage`, `ListAgents` or a `send_message` tool to report.
- **Reports.** Your thread checklist (`update_status`) and your thread replies are the report.
  Keep one checklist: claim, plan, build, verify, PR open, review, merged, cleanup. The five
  report moments (ticket-worker section 4) become one `reply` each, with the PR linked.
- **GitHub.** Use the GitHub MCP tools for issues, labels, PRs, reviews, CI status and merge.
  `git push` over HTTPS still works. Remove `in-progress` with `issue_write` (pass the remaining
  labels) when done or aborted.
- **Waiting.** Instead of `gh-wait`: call `subscribe_pr_activity` for your PR once it is open,
  then end your turn. CI results and review comments wake you. Do not sleep or poll.
- **Copilot loop.** Run it only when the context pack says `Review bot: copilot`. Otherwise
  merge once the local gate and remote CI are green.
- **Reviewer.** Request the requester as reviewer only when they are not the PR author. PRs
  opened through the MCP tools are usually authored by the requester, and GitHub refuses that
  request ("cannot request review from author"): skip it.
- **Evidence.** Save screenshots under `/mnt/project-files/<run-slug>/` and attach them to your
  thread `reply` (`attached_outputs`, kind `file`). The PR body says "Screenshots are in the
  project thread for #<n>". Never create a branch for images.
- **Screenshots stay out of context.** Check a screenshot by script (dimensions, not blank, file
  size) or read one downscaled copy. Never `Read` the full-size PNGs back.
- **Skills.** Load skills with the Skill tool, never `cat` a skill file from the checkout.
- **Memory.** Other threads write to the same memory at the same time. One file per subject;
  re-read the file right before editing it, and edit, never rewrite from an earlier read.
- **Notifications.** Treat subscription and `ReadNotifications` boilerplate as noise: read the
  event it names, not the wrapper.
