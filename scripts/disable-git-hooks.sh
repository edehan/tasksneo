#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CURRENT_HOOKS_PATH="$(git -C "$ROOT_DIR" config --local --get core.hooksPath || true)"

if [[ "$CURRENT_HOOKS_PATH" == ".githooks" ]]; then
  git -C "$ROOT_DIR" config --local --unset core.hooksPath
  echo "Repository git hooks disabled. Git will use the default .git/hooks path again."
  exit 0
fi

if [[ -n "$CURRENT_HOOKS_PATH" ]]; then
  echo "core.hooksPath is set to '$CURRENT_HOOKS_PATH'. Leaving it unchanged."
  exit 0
fi

echo "Repository git hooks are already using the default .git/hooks path."
