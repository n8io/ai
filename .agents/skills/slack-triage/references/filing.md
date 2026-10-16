# Filing details

Read at step 6 of SKILL.md.

## Command

```bash
gh issue create --title "…" --body-file /tmp/<slug>.md --label human --label P1 --label bug \
  --attach /tmp/<slug>.png
```

## Attaching the screenshot

`--attach` the downloaded file (bare path, no `#alt` suffix; needs gh ≥ 2.99.0). gh appends
the embed at the bottom, so capture the `user-attachments/assets/<uuid>` URL from the body
and move it into **From the screenshot** with a follow-up `--body-file` edit. If step 2
could not produce the file, file anyway and note the missing embed in your report.

## The `human` label

Check `gh label list` for `human` before assuming either way (recent issues not using a
label doesn't mean it's missing), and create it only if absent:

```bash
gh label list | grep -q '^human' || gh label create human \
  --description "Directly requested by a user" --color 0E8A16
```

Check `gh label list` for the repo's kind label (`bug` / `feature` / `enhancement`) and
state label too; don't assume. Triage captures the report, grooming decides the approach.
