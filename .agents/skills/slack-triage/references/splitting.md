# One ticket or several

Read at step 3b of SKILL.md. The same thread shape can go either way depending on the work
underneath.

## Signals to combine

- One fix closes all of them — they're symptoms of a single cause.
- They live in the same component, and nobody would sensibly ship one without the others.
- Separately, each is too thin to groom: "the spacing is off" ×4 is one layout ticket.
- They're one user experience. Fixing half leaves the screen still visibly broken.

## Signals to keep separate

- Different causes, different files, different fixes.
- Different kinds — a bug and a feature request don't belong in one ticket even when
  they touch the same screen.
- Wildly different urgency. A data-loss bug bundled with a nice-to-have gets the whole
  ticket scheduled at the slower pace.
- One is ready to work and the other needs a product decision first.

## Why not quietly pick

Both mistakes are expensive and neither is visible after the fact: one bundled ticket hides
a bug behind an unrelated blocker, and four split tickets churn the backlog with duplicates
that close each other.

## Writing a combined ticket

The ticket covers every unit in it, each with its own **Observed** evidence and permalink
under the one canonical anchor. The title names the shared cause, not just the loudest
symptom.
