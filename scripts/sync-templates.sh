#!/usr/bin/env bash
#
# Copy the contract templates into this package so they ship inside the npm
# tarball.
#
#   scripts/sync-templates.sh [source-templates-dir]
#
# Source resolution order:
#   1. the argument, if given
#   2. $SOROBIX_TEMPLATES_SOURCE
#   3. ../soroban-scaffold-templates/templates (a sibling clone)
#
# Run automatically by the "prepack" hook, so `npm pack` and `npm publish`
# cannot produce a tarball without templates in it. That is not a theoretical
# concern: the first tarball built from this package installed cleanly and then
# failed on every `sorobix init`, because template lookup resolved to a sibling
# checkout that does not exist inside node_modules.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="${1:-${SOROBIX_TEMPLATES_SOURCE:-$REPO_ROOT/../soroban-scaffold-templates/templates}}"
DEST="$REPO_ROOT/templates"

if [[ ! -d "$SOURCE" ]]; then
  echo "error: no templates directory at $SOURCE" >&2
  echo "       pass one as an argument or set SOROBIX_TEMPLATES_SOURCE" >&2
  exit 1
fi

SOURCE="$(cd "$SOURCE" && pwd)"

# Single source of truth for which templates must exist: the CLI's own list.
# A template present here but missing from VALID_TEMPLATES cannot be selected,
# and one listed there but missing here fails at scaffold time — so the two
# have to agree, and this reads the list rather than repeating it.
mapfile -t EXPECTED < <(
  sed -n "s/^export const VALID_TEMPLATES = \[\(.*\)\] as const;$/\1/p" \
    "$REPO_ROOT/src/utils/templates.ts" \
    | tr -d "' " | tr ',' '\n' | grep -v '^$'
)

if [[ ${#EXPECTED[@]} -eq 0 ]]; then
  echo "error: could not read VALID_TEMPLATES from src/utils/templates.ts" >&2
  exit 1
fi

missing=()
for template in "${EXPECTED[@]}"; do
  [[ -d "$SOURCE/$template" ]] || missing+=("$template")
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "error: templates listed in VALID_TEMPLATES but absent from $SOURCE:" >&2
  printf '       %s\n' "${missing[@]}" >&2
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$DEST"

for template in "${EXPECTED[@]}"; do
  cp -R "$SOURCE/$template" "$DEST/$template"
  count="$(find "$DEST/$template" -type f | wc -l | tr -d ' ')"
  echo "  synced $template ($count files)"
done

echo "Templates synced from $SOURCE into $DEST"
