#!/usr/bin/env bash
# cloud-setup.sh — paste this into the setup script field of a claude.ai/code environment.
# It clones n8io/ai to a temp dir and runs bootstrap.sh --cloud (plugins, rules, statusline, settings).
# Nothing is piped into a shell. Set N8IO_REF to pin a branch or tag.
set -euo pipefail

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git clone --quiet --depth 1 ${N8IO_REF:+--branch "$N8IO_REF"} https://github.com/n8io/ai "$tmp/ai"
bash "$tmp/ai/setup/bootstrap.sh" --cloud
