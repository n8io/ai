# Scout prompt contract

Read when writing the Step 4 scout prompts. Put these rules in every scout prompt.

## Question format

Each question must be small enough to drop straight into an `AskUserQuestion` option set — no
paragraphs. Exactly:

- `q`: the decision in ONE sentence (≤ ~20 words).
- `example`: ONE short concrete instance that makes the ambiguity obvious — a real label,
  string, or before/after — ≤ ~15 words. It replaces a paragraph of explanation.
- `options`: 2–4 SHORT choices (a few words each), recommended one first.
- `recommendation`: the default + a ≤ 1-line why.

Keep all surrounding rationale OUT of the question — it belongs in `planSummary`, not in what
the user is asked. Tell the scout: "Report just enough to ask the question with one simple
example; do not restate the codebase analysis in the question."

Example of the right altitude:
```
q: Rename the Settings→Achievements tab to match what it does?
example: tab reads "Achievements" but only has a "Recalculate" button
options: "Recalculate" (rec) / "Achievement Rules" / keep "Achievements"
recommendation: "Recalculate" — the tab has no rule config, only a recalc action
```

## Return shape

Each scout returns a structured result so you can aggregate:
`{ issue, planSummary, contextPack, questions: [{ q, example, options, recommendation }] }`.

## Context pack

`contextPack` is markdown covering what the scout learned: the files this issue will touch and
why, the patterns and helpers to follow, where its tests live and how to run them, and gotchas.
Write each one to `<main checkout>/.agents/scratchpad/context/issue-<n>.md` with a trailing
`## Findings` section, and pass that absolute path to the implementer.
