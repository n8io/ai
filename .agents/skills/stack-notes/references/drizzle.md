# Drizzle ORM

- **PR size.** `drizzle-kit generate` writes `drizzle/meta/*_snapshot.json`, a full-schema dump
  that can be thousands of lines. REST `additions` counts it. Judge a size budget on authored
  lines, not raw additions.
- **Sibling migrations collide.** When two parallel tickets both generate migrations, the second
  to merge deletes its generated migration files after rebasing onto the first and re-runs the
  repo's generate command. Never hand-edit the journal. Warn both workers up front.
