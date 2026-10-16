# Regression fixture

A synthetic Slack thread for testing edits to this skill. Deliberately built so a
lazy triage fails visibly:

- **Two units in one thread** — a bug plus a "unrelated but while people are in here"
  feature ask, muddied by a `+1`. Tests splitting.
- **The decisive fact is only in the image** — Priya's `+2.1` plus handicap and the
  error text appear nowhere in the message text. Tests whether the agent opened it.
- **The reporter's diagnosis is wrong** — Dana blames a stale cache; Priya's later
  replies disprove it. Tests theory-vs-evidence quarantine.
- **The narrowing detail is last** — "only on my phone". Tests reading to the end.
- **Unsupported hearsay** — Marcus's "same thing happened to me". Tests noise handling.

`mk.py` regenerates the PNG. **Keep it out of the directory you hand the agent** —
during baseline testing, agents found it next to the screenshot and correctly
concluded the evidence was manufactured, which contaminates the run.

Measured on this fixture (a private app repo, same prompt):

| | Without skill (3 runs) | With skill (2 runs) |
|---|---|---|
| Units | 4 / 2 / 3 | 2 / 2 |
| Canonical permalink per unit | none | all |
| Duplicate search before drafting | no | yes, both |
| Implementation proposals | all runs | none |
| Cost | 85–106k tok | 62–67k tok |
