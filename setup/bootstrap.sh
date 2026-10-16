#!/usr/bin/env bash
# bootstrap.sh — set up the parts of n8io/ai that no plugin system covers.
#
#   1. add the marketplaces and install the `workflow` and `tools` plugins
#   2. put the global rules (AGENTS.md) and statusline script in the Claude config dir
#   3. merge baseline settings into settings.json (never deletes or overwrites your keys, never touches hooks)
#   4. link the workflow skills into ~/.agents/skills for other agents
#
# Safe to re-run: a second run changes nothing. Never prompts. One line per action.
#
# Usage: bootstrap.sh [--cloud] [--dry-run]
#   --cloud     copy files instead of linking, skip the ~/.agents/skills links
#   --dry-run   print what would happen, change nothing
# Env:
#   CLAUDE_CONFIG_DIR         Claude config dir (default ~/.claude)
#   N8IO_MARKETPLACE_SOURCE   marketplace source for n8io (default n8io/ai; a local path works)

set -uo pipefail

CLOUD=0
DRY=0
for arg in "$@"; do
  case "$arg" in
    --cloud) CLOUD=1 ;;
    --dry-run) DRY=1 ;;
    -h | --help) sed -n '2,17p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "bootstrap: unknown option: $arg" >&2; exit 2 ;;
  esac
done

CFG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
[[ -n "${CLAUDE_CONFIG_DIR:-}" ]] && export CLAUDE_CONFIG_DIR
SOURCE="${N8IO_MARKETPLACE_SOURCE:-n8io/ai}"
OFFICIAL_SOURCE="anthropics/claude-plugins-official"
JQ="$(command -v jq || command -v jaq || true)"
CHANGES=0
FAILS=0

say() { printf '%-6s %s\n' "$1" "$2"; }
changed() { CHANGES=$((CHANGES + 1)); }
failed() { FAILS=$((FAILS + 1)); say "FAIL" "$1"; }

# act <message> <command...>: run the command, or only print it in --dry-run.
act() {
  local msg="$1"; shift
  if (( DRY )); then say "would" "$msg"; changed; return 0; fi
  if "$@" </dev/null >/dev/null 2>&1; then say "done" "$msg"; changed; else failed "$msg"; return 1; fi
}

# ---- 1. plugins -------------------------------------------------------------
LOC=""
have_claude=1
if ! command -v claude >/dev/null 2>&1; then
  have_claude=0
  say "warn" "claude CLI not found; skipping marketplaces and plugins"
fi
if [[ -z "$JQ" ]]; then
  say "warn" "jq not found; skipping marketplace lookup and settings merge"
  have_claude=0
fi

marketplace_loc() { # <name> -> install location, empty when not added
  claude plugin marketplace list --json 2>/dev/null </dev/null | "$JQ" -r --arg n "$1" '.[] | select(.name == $n) | .installLocation' 2>/dev/null | head -n1
}
plugin_installed() { # <id>
  claude plugin list --json 2>/dev/null </dev/null | "$JQ" -e --arg id "$1" 'any(.[]; .id == $id)' >/dev/null 2>&1
}
ensure_marketplace() { # <name> <source>
  if [[ -n "$(marketplace_loc "$1")" ]]; then say "ok" "marketplace $1"; return 0; fi
  act "add marketplace $1 ($2)" claude plugin marketplace add "$2"
}

if (( have_claude )); then
  ensure_marketplace claude-plugins-official "$OFFICIAL_SOURCE"
  ensure_marketplace n8io "$SOURCE"
  for p in workflow tools; do
    if plugin_installed "$p@n8io"; then
      say "ok" "plugin $p@n8io"
    else
      act "install plugin $p@n8io (user scope)" claude plugin install "$p@n8io" --scope user
    fi
  done
  LOC="$(marketplace_loc n8io)"
fi
if [[ -z "$LOC" ]]; then
  LOC="$CFG/plugins/marketplaces/n8io" # where it will be; only used for messages and dry runs
  (( have_claude )) && ! (( DRY )) && say "warn" "n8io marketplace location unknown; using $LOC"
fi

# Where to read files from. A dry run before the marketplace exists reads this checkout instead.
READ_ROOT="$LOC"
if (( DRY )) && [[ ! -d "$LOC/setup" ]]; then READ_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; fi

# ---- 2/3. rules and statusline ---------------------------------------------
# place <src> <dst>: link (or copy with --cloud). An existing different regular file is kept as dst.bak.
place() {
  local src="$1" dst="$2" label="${2/#$HOME/~}"
  if (( CLOUD )); then
    if [[ -f "$dst" && ! -L "$dst" ]] && cmp -s "$src" "$dst"; then say "ok" "$label"; return 0; fi
  else
    if [[ -L "$dst" && "$(readlink "$dst")" == "$src" ]]; then say "ok" "$label"; return 0; fi
  fi
  if (( DRY )); then say "would" "$( (( CLOUD )) && echo copy || echo link ) $label"; changed; return 0; fi
  if [[ ! -f "$src" ]]; then failed "$label: source missing ($src)"; return 1; fi
  mkdir -p "$(dirname "$dst")"
  if [[ -e "$dst" && ! -L "$dst" ]]; then
    local bak="$dst.bak"; [[ -e "$bak" ]] && bak="$dst.bak.$(date +%s)"
    mv "$dst" "$bak" && say "done" "keep old $label as ${bak##*/}"
  fi
  rm -f "$dst"
  if (( CLOUD )); then cp "$src" "$dst"; else ln -s "$src" "$dst"; fi
  say "done" "$( (( CLOUD )) && echo copy || echo link ) $label"
  changed
}

place "$LOC/setup/AGENTS.md" "$CFG/AGENTS.md"
for d in "$HOME/.cursor" "$HOME/.codex"; do
  [[ -d "$d" ]] && place "$LOC/setup/AGENTS.md" "$d/AGENTS.md"
done
place "$LOC/setup/statusline-command.sh" "$CFG/statusline-command.sh"

# ---- 3. settings merge ------------------------------------------------------
# Existing keys win. Objects merge key by key, arrays union, hooks are never touched.
MERGE='
def dm($b):
  if type == "object" and ($b | type) == "object" then
    reduce ($b | keys[]) as $k (.; .[$k] = (if has($k) then .[$k] | dm($b[$k]) else $b[$k] end))
  elif type == "array" and ($b | type) == "array" then . + ($b - .)
  else . end;
($base | del(.hooks)) as $b | (. // {}) | dm($b)
'
merge_settings() {
  local base="$READ_ROOT/setup/settings.json" dst="$CFG/settings.json" label="${CFG/#$HOME/~}/settings.json"
  [[ -z "$JQ" ]] && return 0
  if [[ ! -f "$base" ]]; then
    if (( DRY )); then say "would" "merge baseline into $label"; changed; else say "warn" "no baseline settings at $base"; fi
    return 0
  fi
  local basejson cur new
  local cfgarg=""; [[ "$CFG" != "$HOME/.claude" ]] && cfgarg="$CFG"
  basejson="$("$JQ" -c --arg cfg "$cfgarg" --arg src "$SOURCE" '
    (if $cfg != "" and .statusLine.command then .statusLine.command |= gsub("~/\\.claude"; $cfg) else . end)
    | (if $src != "n8io/ai" then del(.extraKnownMarketplaces.n8io) else . end)' "$base")" || { failed "read $base"; return 1; }
  if [[ -f "$dst" ]]; then
    "$JQ" -e . "$dst" >/dev/null 2>&1 || { say "warn" "$label is not valid JSON; left alone"; return 0; }
    cur="$(cat "$dst")"
  else
    cur="null"
  fi
  new="$(printf '%s' "$cur" | "$JQ" -S --argjson base "$basejson" "$MERGE")" || { failed "merge $label"; return 1; }
  if [[ -f "$dst" ]] && [[ "$(printf '%s' "$cur" | "$JQ" -S .)" == "$new" ]]; then say "ok" "$label"; return 0; fi
  if (( DRY )); then say "would" "merge baseline keys into $label"; changed; return 0; fi
  mkdir -p "$CFG"
  printf '%s\n' "$new" >"$dst.tmp.$$" && mv "$dst.tmp.$$" "$dst" && say "done" "merge baseline keys into $label" && changed
}
merge_settings

# ---- 4. skills for other agents ---------------------------------------------
(( CLOUD )) && say "skip" "~/.agents/skills links (--cloud)"
if (( ! CLOUD )) && [[ -d "$READ_ROOT/plugins/workflow/skills" ]]; then
  linked=0 kept=0 skipped=0
  for dir in "$READ_ROOT"/plugins/workflow/skills/*/; do
    name="$(basename "$dir")"; src="$LOC/plugins/workflow/skills/$name"; dst="$HOME/.agents/skills/$name"
    if [[ -L "$dst" && "$(readlink "$dst")" == "$src" ]]; then kept=$((kept + 1)); continue; fi
    if [[ -e "$dst" || -L "$dst" ]]; then
      skipped=$((skipped + 1)); say "skip" "~/.agents/skills/$name exists and is not ours"; continue
    fi
    if (( DRY )); then say "would" "link ~/.agents/skills/$name"; changed; continue; fi
    mkdir -p "$HOME/.agents/skills" && ln -s "$src" "$dst" && { say "done" "link ~/.agents/skills/$name"; changed; linked=$((linked + 1)); }
  done
  say "ok" "~/.agents/skills: $kept already linked, $linked new, $skipped skipped"
elif (( ! CLOUD )); then
  say "skip" "~/.agents/skills links (marketplace clone not found at $LOC)"
fi

# ---- summary ----------------------------------------------------------------
if (( FAILS )); then echo "bootstrap: $FAILS step(s) failed"; exit 1; fi
if (( CHANGES == 0 )); then echo "bootstrap: no changes"
elif (( DRY )); then echo "bootstrap: $CHANGES change(s) would be made (dry run)"
else echo "bootstrap: $CHANGES change(s) made"; fi
