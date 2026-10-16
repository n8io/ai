#!/bin/bash
# Worktree path guard — PreToolUse for Write|Edit|NotebookEdit.
# Denies absolute edit paths that sit in the main checkout instead of the active worktree.
f=$(jq -r '.tool_input.file_path // empty')
[ -z "$f" ] && exit 0
case "$f" in /*) ;; *) exit 0 ;; esac
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
mainroot=$(dirname "$common")
case "$f" in
  "$root"/*|"$root") exit 0 ;;
  "$mainroot"/*) jq -n --arg f "$f" --arg root "$root" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:("Refusing to edit " + $f + " — it is inside this repo but OUTSIDE the active worktree (" + $root + "). You likely resolved the path against the main checkout. Re-anchor it under " + $root + ".")}}' ;;
  *) exit 0 ;;
esac
