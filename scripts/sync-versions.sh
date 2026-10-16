#!/usr/bin/env bash
# sync-versions.sh — write the package.json version into every plugin manifest.
# Run by `changeset version` (see the "version" script in package.json) so manifests ship in the version PR.
# Each plugin has .claude-plugin/plugin.json and an Agent Plugins plugin.json.
set -euo pipefail

cd "$(dirname "$0")/.."
JQ="$(command -v jq || command -v jaq)"
version="$("$JQ" -r .version package.json)"

for dir in plugins/*/; do
  for f in "${dir}.claude-plugin/plugin.json" "${dir}plugin.json"; do
    [[ -f "$f" ]] || continue
    "$JQ" --arg v "$version" '.version = $v' "$f" >"$f.tmp"
    mv "$f.tmp" "$f"
    echo "$f -> $version"
  done
done
