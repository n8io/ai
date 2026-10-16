# Marking edge cases

Read at step 7 of SKILL.md.

- **Several units from one message.** Three units that started in three messages means three
  marked messages. Three units that all started in the one shared message means **one**
  marked message carrying `:robot_face:` plus one outcome (the same emoji can't be added
  twice), so name in your report which issues came from that anchor.
- **Combined ticket.** If you combined units at step 3b, mark the anchor you chose as
  canonical for that ticket. The other origins go in the body as evidence, unmarked.
- **`invalid_name`** means that emoji doesn't exist in the workspace. Say so, and don't
  substitute a different one: a stand-in mark corrupts what the next run reads.
