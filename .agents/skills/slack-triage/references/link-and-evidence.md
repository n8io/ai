# Link and evidence details

Read at steps 1 and 2 of SKILL.md.

## Parsing a permalink

`…/archives/C0AB/p1755100400000300?thread_ts=1755100000.000100`
→ channel `C0AB`, message ts `1755100400.000300` (decimal inserted 6 from the right),
parent `1755100000.000100`.

## When the link points at a reply

That reply is the subject. Read the parent and the sibling replies for context, but don't
promote the parent to the unit unless the reply is plainly a continuation of it ("…and
here's the screenshot"). When it's ambiguous, ask.

## When there is no message

If you were given a bare channel with no message or thread, there is no shared link. Say so
and ask what to triage rather than sweeping the channel.

## Viewing images

MCP `slack_read_file` renders images inline (main session only; it is unauthenticated in
subagents). Otherwise download to a file and open it with Read.

## Downloading images for the embed

Reading inline doesn't give you a file, and the ticket embeds the image at step 6.

1. Get `.message.files[].url_private_download // .url_private` from
   `slackcli conversations get <channel> <ts> --json` (strip the progress lines with
   `sed -n '/^{/,$p'`).
2. Run `~/.claude/bin/slack-download <url> /tmp/<slug>.png` as its own Bash call, not inside
   a compound command, so it matches its allow rule.

If the helper is missing or the download is denied, say so and ask your partner to hand
over the file. Either way, file the ticket.
