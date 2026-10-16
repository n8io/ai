# Writing a worker kickoff

The worker contract lives in the `ticket-worker` skill. A kickoff carries only what varies
per ticket. Template (plain prose, no fenced code, balanced apostrophes):

    You are a ticket worker. Invoke the ticket-worker skill and follow it.
    Issue: #<n> "<title>" in <owner>/<repo>.
    Mode: push | poll.
    Orchestrator: <name> [<ref>]   (push mode; from your own ListAgents first line).
    Context pack: <path, or omit>.
    Settled decisions: <the user's answers and the agreed plan, as decided facts>.
    Size budget: <~N changed files / ~M added lines, counting tests, fixtures and plan; or omit>.
    Predecessor notes: <what the just-merged predecessor decided, left as a seam, or tripped on; or omit>.
    Repo gates: <extra verify commands, service stack to start, current passing baseline count>.
    Flags: <decision-first | prototype-then-decide | branch base <name>; or omit>.

## Kickoff file mechanics

**Write the kickoff to a file first — never inline it.** A kickoff long enough to be useful
will eventually contain an apostrophe or quote, and the nested single-inside-double quoting
terminates the outer string and dies with a zsh `parse error`. Passing the prompt as a bare
argument from a variable removes the entire class of bug:

**Keep the kickoff FILE plain prose — even with the bare-argument pattern, the `KICK="$(cat …)"`
capture + spawn still parse the content.** Two content shapes break it, dying with
`(eval):N: unmatched '`: (1) a triple-backtick FENCED CODE BLOCK (```ts … ```) inside
the kickoff, and (2) an ODD number of single-quotes/apostrophes. Fix both by rule: NO fenced code
blocks and NO multi-line code snippets in a kickoff — describe code behaviour in words and cite
file paths/symbols inline; and keep apostrophes balanced. Inline single backticks around a symbol
are fine; it is the FENCE and the odd-quote count that break the eval.

## Orchestrator-side judgment while writing the kickoff

- **Decision-first tickets need a HARD gate.** When the ticket says a decision is required
  before implementation (or the central question is a product/privacy/UX call rather than a
  technical one), "ask before implementing" is NOT enough. Say verbatim: "This ticket is decision-first. After investigating, your FIRST action
  must be to ask the question — you may not write a plan file or touch implementation code
  until it is answered. Do not decide a product/privacy call on the user's behalf, and do not
  rationalize a guess as obvious." In push mode the ask itself is the kind-4 report to the
  orchestrator (single ask surface — no in-session dialog); the orchestrator presents it in
  chat via AskUserQuestion and relays the answer back, which IS the confirmation. Then, as
  orchestrator, actually watch for it: if the pane shows a plan being written or a task
  executing with no question having been asked, halt the worker and make it state on whose
  authority it chose.
  - **Resolve a ticket's OWN stated open-questions with the user BEFORE dispatch when they are
    pure product/UX calls that need no code investigation — do not round-trip them through the
    worker.** A well-groomed ticket often ships with an explicit "Open questions" section. When
    those questions are product/UX judgment the user answers from the ticket alone (not "which
    of these files is the real call site", which needs the worker to dig), ask them yourself via
    AskUserQuestion up front — lead with the reporter's-wording recommendation as the first
    option — and bake the locked answers into the kickoff with a "these are already decided, do
    NOT re-ask" line. This is strictly better than the default worker-investigates-then-asks
    loop: it removes a full block-and-relay round-trip and the worker never idles waiting. Only
    defer a stated open-question to the worker when answering it genuinely requires reading the
    code first.
- **Prototype-then-decide: the strongest form of a decision-first ticket whose decision
  hinges on facts only building reveals** (real diff size, does it actually work, true
  dependency/perf impact). Rather than have the worker ask cold or build blind, dispatch it
  to BUILD A PROVEN PROTOTYPE that coexists with the current code (touches nothing
  production-facing, suite stays green either way), run full Verify, MEASURE the real numbers
  and re-derive the ticket's claims — then STOP at a hard gate and report evidence + a
  recommendation. The go/no-go is the user's, relayed by the orchestrator in chat (an
  in-session answer / pane draft is NOT authorization). Merge discipline applies ONLY AFTER
  the relayed GO. **Visual-pick evidence must be viewable on the user's PHONE:** have the
  worker upload the variant images DIRECTLY into a comment on the ISSUE through the github.com
  editor (see the media rule under merge discipline; no assets branch) BEFORE the gate is
  presented, and link that comment in the chat question. Local file paths, Preview.app, and downscaled composites all
  fail. As orchestrator, surface the
  prototype report to the user via AskUserQuestion (GO/KEEP) + one PushNotification, and never
  let green CI on the prototype branch auto-merge before the decision.
  - If the worker's upload path is blocked (auto-mode classifier, browser tools unavailable),
    do not fall back to an assets branch — hold the merge, confirm the pick in chat, then GO.
    Flag the block at loop end.
  - **When a scope answer is "do X first, defer the mechanical rest if it doesn't stay
    reviewable", give the worker a CONCRETE size threshold in the kickoff** — e.g. "defer the
    mechanical remainder to a scoped follow-up if wiring it would push the PR past ~20 changed
    files / ~800 added lines." Otherwise "reviewable" is a guess, and a diligent worker will
    fold the whole sweep in. As
    orchestrator, when a PR closing a decision-first/ADR ticket comes in materially larger than
    the chosen scope implied, HOLD the merge and surface the diff size to the user before it
    lands — a codebase-wide convention change across every context is not something to let
    auto-merge on green CI without the deliberating user seeing the final size.
  - **Say the budget counts tests, fixtures and the plan doc — workers estimate production code
    only.** A worker that estimates production code alone will omit tests, fixtures and the plan
    doc from its count and blow through an authorized size without meaning to.
  - **A size hold CANNOT be enforced reactively from the poll loop — arm it in the kickoff.**
    An orchestrator that notices the diff when CI goes green is already too late. So every
    kickoff's merge
    -discipline block gets a standing exception: "if your final diff exceeds the size budget, or
    materially exceeds a size you were authorized for, report the real numbers and WAIT for an
    explicit GO before merging."
  - **Clear a trivial overage yourself; it is your budget.** A dozen-odd lines over, all of it
    one golden test, is noise to escalate. Verify the real numbers by REST, send
    a GO labelled as the orchestrator's, and say why it is not material. Escalate only when the
    overage is large or lands in production code the user has not seen.
  - **Generated files don't count toward the size budget.** REST `additions` includes migration
    snapshots, lockfiles and codegen output. Judge on authored lines (see `stack-notes` for each
    stack's generated paths), or you will falsely trip a size-hold on a small PR.
  - As orchestrator: at harvest, if the worker filed follow-ups, CHECK whether each was really
    separable, and say so in the report line. A run that closes fewer issues than it opens is
    a failed run, however good the individual PRs were.

  **Orchestrator-side corollary — do the cheap pre-dispatch check YOURSELF when a predecessor
  merged THIS run touched the ticket's target files.** Before writing the kickoff, run one cheap
  grep/read on `main` to see whether the premise still holds — the fix may already be in. If it is,
  scope the worker as VERIFY-THEN-CLOSE (or verify-then-minimal-residual), not reimplement, and say
  so in the kickoff with the predecessor named. This costs one Bash call and can delete an entire
  redundant PR.
- **Cross-ticket handoff** (when tickets form a dependency chain — ADR follow-ups, epic
  sub-issues): thread the just-merged predecessor's decisions and gotchas into the successor's
  kickoff. Carry forward the seam left for this ticket, any user decisions already locked, and
  latent bugs/near-misses the predecessor hit. This pays off — e.g. a successor caught that an
  ADR payload named a field (`netStrokes`) undefined in the context meant to emit it, and
  raised it as a live clarifying question instead of guessing wrong.
