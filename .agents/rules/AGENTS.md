# Shared AI Coding Assistant Rules

Always prefer these faster alternatives in shell commands:
- `rg` instead of `grep`
- `fd` instead of `find`
- `eza` instead of `ls`
- `bat` instead of `cat`
- `sd` instead of `sed`/`awk`
- `uv` instead of `pip`/`pip3`
- `jaq` instead of `jq`
- `fnm` instead of `nvm`
- `pnpm` instead of `npm`
- `bun` instead of `pnpm`

## How I work

These hold in every repo. A repo's own AGENTS.md or project memory can override one, and when it does, the repo wins.

### Talking to me

- Talk like one person to another. Plain words, short sentences, lead with the answer. One line is often enough.
- No report theater: no verdict headers, no status tables or bullet dumps to dress up an update. Bullets and tables are fine when the data needs them.
- No metaphors or idioms. Say the literal thing.
- Ask questions as the underlying human choice, in as few words as possible, with short option labels. No preamble.
- Only ask "sound right?" when there are two or more real options. With one option, state it and keep going.
- Before a step that will take more than about a minute, say what you are waiting on and roughly how long.

### Where I am

I am almost never at the machine running the sessions. I reach them through, in order of preference: Claude Code on the web (claude.ai/code), the Claude mobile app, the desktop app, and only last the terminal. Design every interaction for the web.

- **Never ask me to run a command.** No `! <command>` suggestions, no "run this in your terminal", no `tmux attach`. If a command can run in a session, run it yourself. That includes seeds, installs, git pushes, generating secrets, auth probes and builds.
- **When a step truly needs a human**, say why in one line and give the path that works from a phone: a web URL to click (GitHub, a cloud console, an OAuth page), a code or answer I can type into chat, or a physical action. For an OAuth or device login, send me the URL; I paste the code back in chat and you type it into the session. Batch these and ask them up front (bedtime preflight), not mid-run.
- **Things that can't be done from a phone** (a `sudo` password, plugging in hardware, a GUI app on the Mac): name them as blockers before the run starts so I can plan to be at the machine, and propose a way to remove them for next time.
- **Never point me at a local file path.** I can't open `/tmp/shot.png` from my phone. Send the file with SendUserFile, put it on the PR or issue, or publish it as an artifact.
- **Links I can tap.** PR, issue, artifact and console links as full `https://` URLs. Refer to sessions by their Remote Control name, which is how they appear in claude.ai/code.
- **Questions go through AskUserQuestion** in the session I'm talking to, never an input only the terminal pane can see.
- **Anything visual is a published HTML artifact** (a claude.ai link I can open on my phone): prototypes, mockups, reports, trackers, diagrams. Never a local `.html` file for me to open, and never the Claude Design canvas type (it is unusable on mobile web), even when a tool suggests it for design work. Lay pages out for phone width first, and scale fixed-size screens (a 1280×800 frame, a desktop layout) to fit the viewer's width. Within one piece of work (one `/ship` run, one prototype decision), update the same artifact URL as it changes. A new run or a new piece of work gets its own new artifact; never reuse one from an earlier run.

### From idea to build

- Grill me hard up front, so the build can run hands-free. Every question settled before code starts is one a worker never has to park on.
- Once the questions are answered, do not ask me to review or approve the written spec or plan. Self-review it, tell me the path in one line, and keep going. Stop only for a genuinely new decision, a secret, or a risky outward action.
- Always execute plans subagent-driven. Never ask "subagent or inline?".
- Specs, plans and anything under `.claude/scratchpad/` are working files: write them to disk but do not commit them, unless the repo's own rules say plans ship on the branch. Stage by explicit path, never `git add -A` or `git add .`.

### Shared language

Each repo keeps one glossary: `CONTEXT.md` at the root, in `grill-with-docs`'s format. It is the source of truth for domain names in code, tests, UI copy, tickets, PRs and commits.

- The repo's `CLAUDE.md` imports it with an `@CONTEXT.md` line so every session loads it. Add that line whenever you create the glossary or find it missing.
- Use the canonical term, never one of its `_Avoid_` aliases. Run `glossary-check` (in `~/.claude/bin`) before opening a PR; it warns on aliases in added lines, and you judge each hit.
- A new or changed term lands in `CONTEXT.md` in the same PR that introduces it. A term I haven't agreed to is a question for me, not a guess.
- When existing code uses another word for a glossary term, don't rename it in passing. File one rename ticket per term.
- No `CONTEXT.md` yet: create it the first time a term is settled.

### Choosing models

The agent that plans or dispatches the work picks a model for each task, by what the task needs, and says which it picked when it fans out. Name tiers, never pinned versions; the alias resolves to the latest model in that tier.

- **Opus, medium effort** — grilling, design, planning, orchestration, debugging, final review, and anything with real judgment in it. This is also the default for worker sessions that run a ticket end to end.
- **Sonnet** — well-specified implementation from a plan: multi-file changes, integration work, spec-compliance and code-quality review of a single task.
- **Haiku** — mechanical tasks with one obvious right answer: renames, find-and-replace, formatting sweeps, file moves, running and timing commands, inventories, checking that paths exist.
- Raise effort above medium only for review or verification that genuinely needs it.
- Never use a Fable model in workers or subagents unless I ask for it.
- Pass the model explicitly when spawning a CLI worker (`--model opus --effort medium`); never let it inherit the parent's model.

### Git, PRs and merging

- Pushing a feature branch is always pre-approved. Never push to `main`.
- Once a PR is merge-ready (review feedback resolved, checks green on the latest push, and a fresh fetch shows no new commits on `main` to rebase onto), merge it without asking. Report the merged PR link afterward. An explicit "don't merge X yet" still wins.
- Squash merge by default; never hand-squash commits first. Repos that keep linear rebase history say so in their own rules.
- If the permission classifier blocks a push or merge I have already approved, say the harness blocked it and ask whether to proceed. Do not describe it as my rule asking for approval.

### Sessions and progress

- Start sessions with `cs` (in `~/.claude/bin`): tmux, bypassed permissions, Claude in Chrome, and a Remote Control named after the repo and branch. Workers spawned by an orchestrator use the same flags so cross-session messages are never held.
- For work you expect to run longer than about 30 minutes, publish a live tracker with the `progress-tracker` skill and give me the link once. Update it at each step; I peek when I want to.

### Improving skills and memory

Skills and memory improve after every run, and they must not grow without limit.

- Run `skill-budget` before proposing a skill edit and after making it. Budgets: SKILL.md 200 lines, each reference file 350, CHANGELOG.md 150. An edit that would push a file over its budget must first remove or merge something of equal size: one rule in, one rule out.
- Edit an existing rule before adding a new one. Merge rules that say the same thing.
- SKILL.md holds the steps. Situational lessons go in `references/`, read only when the situation comes up. Incident history and dates go in CHANGELOG.md, never in the steps.
- Evidence for a rule is one short clause, not a story.
- A lesson about one repo goes in that repo's memory, not a shared skill. A rule that shows up in two or more repos' memories moves here, and the copies get deleted.
- When CHANGELOG.md goes over budget, collapse its oldest entries into a one-paragraph summary.
- Show me the diff for skill edits before writing them. Memory updates don't need approval.

### Notifications

- Send a push notification only when you need me to answer something: a clarifying question, a permission prompt, or a re-auth. Report everything else (PR opened, merged, CI green or red, ticket done) in the chat.
- Push notifications reach my phone only while Remote Control is connected to the session. Never claim a phone notification was delivered because the tool said "requested".
