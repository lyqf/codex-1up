#!/usr/bin/env bash
set -euo pipefail

need() { command -v "$1" >/dev/null 2>&1; }
check() { if need "$1"; then echo "✔ $1"; else echo "✖ $1 (missing)"; fi }

toml_root_value() {
  local key="$1"
  local file="$2"
  awk -v k="$key" '
    BEGIN { in_root = 1 }
    /^[[:space:]]*\[/ { in_root = 0 }
    in_root && $0 !~ /^[[:space:]]*#/ {
      line = $0
      sub(/^[[:space:]]+/, "", line)
      if (index(line, k " ") == 1 || index(line, k "=") == 1) {
        sub(/^[^=]*=/, "", line)
        sub(/[[:space:]]+$/, "", line)
        gsub(/^[[:space:]]+/, "", line)
        gsub(/^"|"$/, "", line)
        print line
        exit
      }
    }
  ' "$file"
}

toml_table_value() {
  local table="$1"
  local key="$2"
  local file="$3"
  awk -v t="$table" -v k="$key" '
    BEGIN { in_table = 0 }
    {
      raw = $0
      trimmed = raw
      sub(/^[[:space:]]+/, "", trimmed)
      sub(/[[:space:]]+$/, "", trimmed)
      if (trimmed ~ /^[[]/) {
        if (trimmed == "[" t "]") {
          in_table = 1
          next
        }
        if (in_table) {
          exit
        }
      }
      if (in_table && trimmed !~ /^#/ && trimmed ~ ("^" k "[[:space:]]*=")) {
        sub(/^[^=]*=/, "", trimmed)
        sub(/[[:space:]]+$/, "", trimmed)
        gsub(/^[[:space:]]+/, "", trimmed)
        gsub(/^"|"$/, "", trimmed)
        print trimmed
        exit
      }
    }
  ' "$file"
}

echo "codex-1up doctor"
echo "--- binaries ---"
for c in node npm codex ast-grep rg fd fdfind fzf jq yq bat batcat git delta gh code; do
  check "$c"
done

echo "--- codex paths ---"
if command -v codex >/dev/null 2>&1; then
  # Show all codex candidates on PATH (guarded to avoid exiting with -e)
  type -a codex 2>/dev/null || which -a codex 2>/dev/null || command -v codex 2>/dev/null
else
  echo "codex not found on PATH"
fi

echo "--- git ---"
echo "diff.external = $(git config --global --get diff.external || echo "(none)")"
echo "core.pager = $(git config --global --get core.pager || echo "(none)")"

echo "--- codex config ---"
CFG="$HOME/.codex/config.toml"
if [ -f "$CFG" ]; then
  echo "found: $CFG"
  active_profile="$(toml_root_value "profile" "$CFG")"
  [ -n "$active_profile" ] || active_profile="(unset)"
  echo "profile = ${active_profile}"

  ws_profile=""
  if [ "$active_profile" != "(unset)" ]; then
    ws_profile="$(toml_table_value "profiles.${active_profile}.features" "web_search_request" "$CFG")"
  fi
  ws_root="$(toml_table_value "features" "web_search_request" "$CFG")"

  effective_ws="$ws_profile"
  source_label="profiles.${active_profile}.features"
  if [ -z "$effective_ws" ]; then
    effective_ws="$ws_root"
    source_label="features"
  fi

  if [ -n "$effective_ws" ]; then
    echo "✔ web_search_request = ${effective_ws} (${source_label})"
  else
    echo "✖ web_search_request not set (expected under [features] or [profiles.<name>.features])"
  fi
else
  echo "✖ ~/.codex/config.toml not found"
fi

echo "--- shell rc hints ---"
echo "SHELL=$SHELL"
for rc in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.config/fish/config.fish"; do
  if [ -f "$rc" ]; then
    if grep -q "# >>> codex-1up >>>" "$rc"; then
      echo "Found codex-1up block in $rc"
    elif grep -q ">>> codex-1up >>>" "$rc"; then
      echo "Found codex-1up block in $rc (legacy format - remove manually)"
    fi
  fi
done

echo "Done."
