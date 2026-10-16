#!/bin/bash
# Tool guard — runs on PreToolUse for Bash, Write, and Edit.
# Blocks the most catastrophically destructive operations.
# Exit 2 = block; exit 0 = allow.

input=$(cat)
tool_name=$(printf '%s' "$input" | jq -r '.tool_name // ""' 2>/dev/null)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null)
file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // ""' 2>/dev/null)

# ── Bash command guards ────────────────────────────────────────────────────────
if [ "$tool_name" = "Bash" ]; then

    # 1. Recursive force-delete targeting root, home, or bare wildcards
    #    Catches: rm -rf /, rm -fr ~, rm -rf /*, rm -r -f ~/
    if printf '%s' "$command" | grep -qiE '\brm\b' \
    && printf '%s' "$command" | grep -qE '\-[a-zA-Z]*[rR]' \
    && printf '%s' "$command" | grep -qE '\-[a-zA-Z]*[fF]' \
    && printf '%s' "$command" | grep -qE '(\s/?[*]\s*$|\s/\s*$|\s~/?\*?\s*$|\s~\s*$|\s\.\./\.\.)'; then
        echo "BLOCKED: Recursive force-delete targeting root, home, or broad path." >&2
        exit 2
    fi

    # 2. Piping remote content directly to shell execution
    #    Catches: curl ... | bash, wget ... | sh, curl ... | python, etc.
    if printf '%s' "$command" | grep -qiE '(curl|wget)\s.+\|\s*(ba)?sh\b' \
    || printf '%s' "$command" | grep -qiE '(curl|wget)\s.+\|\s*python3?\b' \
    || printf '%s' "$command" | grep -qiE '(curl|wget)\s.+\|\s*node\b'; then
        echo "BLOCKED: Piping remote web content directly to shell/interpreter execution." >&2
        exit 2
    fi

    # 3. Any git push/fetch/branch/rebase using bare --force or -f shorthand
    #    --force-with-lease and --force-if-includes are allowed.
    #    Catches: git push --force, git fetch -f, git branch -f, git rebase --force, etc.
    if printf '%s' "$command" | grep -qiE '\bgit\s+(push|fetch|branch|rebase|reset|checkout)'; then
        # Strip safe force variants first to avoid false positives
        _stripped=$(printf '%s' "$command" \
            | sed 's/--force-with-lease[^[:space:]]*/SAFE/g; s/--force-if-includes/SAFE/g')
        if printf '%s' "$_stripped" | grep -qE '(^|[[:space:]])--force([[:space:]]|$|=)' \
        || printf '%s' "$_stripped" | grep -qE '(^|[[:space:]])-[a-zA-Z]*f([[:space:]]|$)'; then
            echo "BLOCKED: git --force is not allowed. Use --force-with-lease instead." >&2
            exit 2
        fi
    fi

    # 4. Writing directly to block devices (disk wipe)
    #    Catches: dd ... of=/dev/sda, dd ... of=/dev/nvme0
    if printf '%s' "$command" | grep -qiE '\bdd\b' \
    && printf '%s' "$command" | grep -qiE 'of=/dev/(sd|hd|nvme|vd|xvd)[a-z0-9]'; then
        echo "BLOCKED: Direct write to block device (potential disk wipe)." >&2
        exit 2
    fi

fi

# ── File write guards (Write & Edit tools) ────────────────────────────────────
if [ "$tool_name" = "Write" ] || [ "$tool_name" = "Edit" ]; then

    # Block writes to privileged system files that could grant root access or break the OS
    if printf '%s' "$file_path" | grep -qE '^/etc/(passwd|shadow|sudoers|sudoers\.d/|cron(\.d|tab)?/|ssh/)' \
    || printf '%s' "$file_path" | grep -qE '^/boot/' \
    || printf '%s' "$file_path" | grep -qE '^/(usr|bin|sbin)/s?bin/' \
    || printf '%s' "$file_path" | grep -qE '(^|/)\.ssh/authorized_keys$'; then
        echo "BLOCKED: Write to sensitive system path: $file_path" >&2
        exit 2
    fi

fi

exit 0
