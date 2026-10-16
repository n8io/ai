#!/bin/bash
# Claude Code status line - based on oh-my-zsh robbyrussell theme

input=$(cat)

# Single jq call for all fields we need from input
{ read -r cwd; read -r used_pct; } < <(echo "$input" | jq -r '
  (.workspace.current_dir // .cwd // ""),
  (.context_window.used_percentage // "")
')
[ -z "$cwd" ] && cwd=$(pwd)
dir=$(basename "$cwd")

# ANSI color codes using $'...' syntax so they are interpreted at assignment time
RESET=$'\033[0m'
BOLD_BLUE=$'\033[1;34m'
RED=$'\033[0;31m'
CYAN=$'\033[0;36m'
BOLD_GREEN=$'\033[1;32m'
YELLOW=$'\033[33m'
MAGENTA=$'\033[0;35m'
GRAY=$'\033[0;90m'

# Git branch, dirty file count, and ahead/behind
git_info=""
git_dir=$(git -C "$cwd" rev-parse --git-dir 2>/dev/null)
if [ -n "$git_dir" ]; then
  branch=$(git -C "$cwd" symbolic-ref --short HEAD 2>/dev/null || git -C "$cwd" rev-parse --short HEAD 2>/dev/null)
  if [ -n "$branch" ]; then
    # Detect linked worktree: git-dir contains .git/worktrees/<name>
    worktree_part=""
    case "$git_dir" in
      */.git/worktrees/*)
        worktree_part="🌳 "
        dir=$(basename "${git_dir%/.git/worktrees/*}")
        ;;
    esac
    # Dirty file count
    dirty_count=$(git -C "$cwd" status --porcelain 2>/dev/null | wc -l)
    dirty_count="${dirty_count// /}"
    if [ "${dirty_count:-0}" -gt 0 ] 2>/dev/null; then
      dirty_part=" ${YELLOW}✗${dirty_count}${RESET}"
    else
      dirty_part=""
    fi
    # Ahead/behind relative to upstream (skip if no upstream is set)
    ahead=0; behind=0
    if git -C "$cwd" rev-parse --abbrev-ref '@{upstream}' > /dev/null 2>&1; then
      read -r ahead behind <<< "$(git -C "$cwd" rev-list --left-right --count HEAD...@{upstream} 2>/dev/null)"
    fi
    ab_part=""
    if [ "${ahead:-0}" -gt 0 ] || [ "${behind:-0}" -gt 0 ]; then
      [ "${ahead:-0}" -gt 0 ]  && ab_part="${ab_part}${BOLD_GREEN}↑${ahead}${RESET}"
      [ "${behind:-0}" -gt 0 ] && ab_part="${ab_part}${RED}↓${behind}${RESET}"
      ab_part=" ${ab_part}"
    fi
    git_info="${worktree_part}${BOLD_BLUE}git:(${RED}${branch}${BOLD_BLUE}${dirty_part}${ab_part}${BOLD_BLUE})${RESET}"
  fi
fi

CACHE_DIR="${HOME}/.ai-config/cache"
mkdir -p "$CACHE_DIR"

# PR link — cached per branch for 5 minutes
pr_info=""
if [ -n "$branch" ]; then
  ${now_ts+:} now_ts=$(date +%s)
  safe_branch=$(printf '%s' "$branch" | tr '/' '-' | tr -cd '[:alnum:]-_.')
  PR_CACHE="${CACHE_DIR}/pr-${safe_branch}"
  if [ ! -f "$PR_CACHE" ] || [ $(( now_ts - $(stat -f %m "$PR_CACHE" 2>/dev/null || echo 0) )) -gt 300 ]; then
    pr_out=$(cd "$cwd" && gh pr view --json number,url -q '"\(.number)|\(.url)"' 2>/dev/null || echo "")
    printf '%s' "$pr_out" > "$PR_CACHE"
  else
    pr_out=$(cat "$PR_CACHE" 2>/dev/null)
  fi
  pr_num="${pr_out%%|*}"
  pr_url="${pr_out#*|}"
  if [ -n "$pr_num" ] && [ "$pr_num" != "null" ]; then
    pr_info=$'\033]8;;'"${pr_url}"$'\033\\'"${CYAN}#${pr_num}${RESET}"$'\033]8;;\033\\'
  fi
fi

# Node.js version — only in Node project directories, cached for 1 hour
node_info=""
NODE_VER_CACHE="${CACHE_DIR}/node-ver-cache"
if [ -f "${cwd}/.nvmrc" ] || [ -f "${cwd}/.node-version" ] || [ -f "${cwd}/package.json" ]; then
  now_ts=$(date +%s)
  if [ ! -f "$NODE_VER_CACHE" ] || [ $(( now_ts - $(stat -f %m "$NODE_VER_CACHE" 2>/dev/null || echo 0) )) -gt 3600 ]; then
    if command -v node > /dev/null 2>&1; then
      raw=$(node --version 2>/dev/null)
      raw="${raw#v}"
      node_ver="${raw%%.*}"
      [ -n "$node_ver" ] && echo "$node_ver" > "$NODE_VER_CACHE"
    fi
  else
    node_ver=$(cat "$NODE_VER_CACHE" 2>/dev/null)
  fi
  [ -n "$node_ver" ] && node_info="${BOLD_GREEN}⬡ ${node_ver}${RESET}"
fi

# 5-hour usage + plan name from Claude.ai API
five_h_info=""
FIVE_H_CACHE="${CACHE_DIR}/5h-cost-cache"
FIVE_H_RESET_CACHE="${CACHE_DIR}/5h-reset-cache"
PLAN_CACHE="${CACHE_DIR}/plan-name-cache"
CLAUDE_SESSION="${HOME}/.claude/claude-ai-session.json"
${now_ts+:} now_ts=$(date +%s)  # reuse if already set above

# Usage: refresh at most every 60 seconds (changes frequently)
if [ ! -f "$FIVE_H_CACHE" ] || [ $(( now_ts - $(stat -f %m "$FIVE_H_CACHE" 2>/dev/null || echo 0) )) -gt 60 ]; then
  if [ -f "$CLAUDE_SESSION" ]; then
    api_out=$(python3 - <<'PYEOF' 2>/dev/null
import urllib.request, json, sys, os
try:
    cfg = json.loads(open(os.path.expanduser("~/.claude/claude-ai-session.json")).read())
    org_id = cfg["org_id"]
    session_key = cfg["session_key"]
except:
    sys.exit(1)
headers = {
    "accept": "*/*",
    "anthropic-client-platform": "web_claude_ai",
    "content-type": "application/json",
    "cookie": f"sessionKey={session_key}; lastActiveOrg={org_id}",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
}
try:
    with urllib.request.urlopen(urllib.request.Request(
        f"https://claude.ai/api/organizations/{org_id}/usage", headers=headers
    ), timeout=5) as r:
        data = json.loads(r.read())
        fh = data.get("five_hour", {})
        util = fh.get("utilization", None)
        resets_at = fh.get("resets_at", "")
        if util is not None:
            from datetime import datetime, timezone
            reset_ts = int(datetime.fromisoformat(resets_at).astimezone(timezone.utc).timestamp()) if resets_at else 0
            print(f"{int(round(float(util)))}|{reset_ts}")
except:
    sys.exit(1)
PYEOF
)
    five_h_pct="${api_out%%|*}"
    five_h_reset_ts="${api_out#*|}"
  fi
  [ -n "$five_h_pct" ] && echo "$five_h_pct" > "$FIVE_H_CACHE"
  [ -n "$five_h_reset_ts" ] && echo "$five_h_reset_ts" > "$FIVE_H_RESET_CACHE"
else
  five_h_pct=$(cat "$FIVE_H_CACHE" 2>/dev/null)
  five_h_reset_ts=$(cat "$FIVE_H_RESET_CACHE" 2>/dev/null)
fi

# Plan name: refresh at most every 6 hours (almost never changes)
plan_name=$(cat "$PLAN_CACHE" 2>/dev/null)
if [ ! -f "$PLAN_CACHE" ] || [ $(( now_ts - $(stat -f %m "$PLAN_CACHE" 2>/dev/null || echo 0) )) -gt 21600 ]; then
  if [ -f "$CLAUDE_SESSION" ]; then
    fetched_plan=$(python3 - <<'PYEOF' 2>/dev/null
import urllib.request, json, sys, os
try:
    cfg = json.loads(open(os.path.expanduser("~/.claude/claude-ai-session.json")).read())
    org_id = cfg["org_id"]
    session_key = cfg["session_key"]
except:
    sys.exit(1)
headers = {
    "accept": "*/*",
    "anthropic-client-platform": "web_claude_ai",
    "content-type": "application/json",
    "cookie": f"sessionKey={session_key}; lastActiveOrg={org_id}",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
}
try:
    with urllib.request.urlopen(urllib.request.Request(
        f"https://claude.ai/api/organizations/{org_id}", headers=headers
    ), timeout=5) as r:
        org = json.loads(r.read())
        tier = org.get("rate_limit_tier", "")
        caps = org.get("capabilities", [])
        if "claude_max" in caps or "claude_max" in tier:
            plan = "Max 20x" if "20x" in tier else "Max 5x" if "5x" in tier else "Max"
        elif "pro" in tier.lower() or "pro" in caps:
            plan = "Pro"
        elif "team" in tier.lower() or "team" in caps:
            plan = "Team"
        else:
            plan = ""
        print(plan)
except:
    sys.exit(1)
PYEOF
)
    [ -n "$fetched_plan" ] && plan_name="$fetched_plan" && echo "$plan_name" > "$PLAN_CACHE"
  fi
fi

if [ -n "$five_h_pct" ] && [ "$five_h_pct" != "0" ] && [ "$five_h_pct" != "null" ]; then
  if [ "${five_h_pct:-0}" -ge 80 ] 2>/dev/null; then
    fh_color=$RED
  elif [ "${five_h_pct:-0}" -ge 50 ] 2>/dev/null; then
    fh_color=$YELLOW
  else
    fh_color=$BOLD_GREEN
  fi
  # Time until window resets + pace emoji
  reset_part=""
  pace_emoji=""
  if [ -n "$five_h_reset_ts" ] && [ "$five_h_reset_ts" -gt 0 ] 2>/dev/null; then
    secs_left=$(( five_h_reset_ts - now_ts ))
    if [ "$secs_left" -gt 0 ] 2>/dev/null; then
      hrs_left=$(( secs_left / 3600 ))
      mins_left=$(( (secs_left % 3600) / 60 ))
      if [ "$hrs_left" -gt 0 ]; then
        reset_part="${GRAY} ↻${hrs_left}h${mins_left}m${RESET}"
      else
        reset_part="${GRAY} ↻${mins_left}m${RESET}"
      fi
      # Project utilization at end of window
      elapsed=$(( 18000 - secs_left ))
      if [ "$elapsed" -gt 60 ] 2>/dev/null; then
        projected=$(( five_h_pct * 18000 / elapsed ))
        if [ "$projected" -gt 100 ]; then
          pace_emoji="🔥"
        elif [ "$projected" -ge 85 ]; then
          pace_emoji="🌡️"
        else
          pace_emoji="❄️"
        fi
      fi
    fi
  fi
  OSC8_OPEN=$'\033]8;;https://claude.ai/settings/usage\033\\'
  OSC8_CLOSE=$'\033]8;;\033\\'
  five_h_info="${OSC8_OPEN}${pace_emoji:+${pace_emoji} }${fh_color}${five_h_pct}%/5h${reset_part}${RESET}${OSC8_CLOSE}"
fi

# Claude Code usage stats — progress bar via string slicing (no subprocesses)
BLOCKS="██████████"
EMPTIES="░░░░░░░░░░"
usage_info=""
if [ -n "$used_pct" ]; then
  used_pct_int=$(printf "%.0f" "$used_pct")
  if [ "$used_pct_int" -ge 80 ] 2>/dev/null; then
    pct_color=$RED
  elif [ "$used_pct_int" -ge 50 ] 2>/dev/null; then
    pct_color=$YELLOW
  else
    pct_color=$BOLD_GREEN
  fi
  filled=$(( used_pct_int * 10 / 100 ))
  [ "$filled" -gt 10 ] && filled=10
  empty=$(( 10 - filled ))
  usage_info="${pct_color}${BLOCKS:0:$filled}${GRAY}${EMPTIES:0:$empty} ${used_pct_int}%${RESET}"
fi

# Plan name display
plan_info=""
[ -n "$plan_name" ] && plan_info="${MAGENTA}${plan_name}${RESET}"

# Build output by joining non-empty segments with a dim gray pipe separator
PIPE="${GRAY} | ${RESET}"
segments=()
[ -n "$CLAUDE_BOX" ]   && segments+=("🔐")
[ -n "$git_info" ]     && segments+=("$git_info")
[ -n "$pr_info" ]      && segments+=("$pr_info")
[ -n "$node_info" ]    && segments+=("$node_info")
[ -n "$plan_info" ]    && segments+=("$plan_info")
[ -n "$five_h_info" ]  && segments+=("$five_h_info")
[ -n "$usage_info" ]   && segments+=("$usage_info")

# Join segments
joined=""
for seg in "${segments[@]}"; do
  if [ -z "$joined" ]; then
    joined="$seg"
  else
    joined="${joined}${PIPE}${seg}"
  fi
done

if [ -n "$joined" ]; then
  printf "%s  %s%s%s%s%s%s\n" "${BOLD_GREEN}➜${RESET}" "${CYAN}" "$dir" "${RESET}" "${PIPE}" "$joined" ""
else
  printf "%s  %s%s%s\n" "${BOLD_GREEN}➜${RESET}" "${CYAN}" "$dir" "${RESET}"
fi
