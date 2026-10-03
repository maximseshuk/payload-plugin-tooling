#!/bin/sh
command -v jq >/dev/null || exit 0
file=$(jq -r '.tool_input.file_path // empty')
case "$file" in "$CLAUDE_PROJECT_DIR"/*) ;; *) exit 0 ;; esac
bin="$CLAUDE_PROJECT_DIR/node_modules/.bin"
[ -x "$bin/oxfmt" ] || exit 0

case "$file" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs)
    "$bin/oxlint" --fix --quiet "$file" >/dev/null 2>&1
    "$bin/oxfmt" --no-error-on-unmatched-pattern "$file" >/dev/null 2>&1
    if ! out=$("$bin/oxlint" --quiet "$file" 2>&1); then
      echo "$out" >&2
      exit 2
    fi
    ;;
  *) "$bin/oxfmt" --no-error-on-unmatched-pattern "$file" >/dev/null 2>&1 ;;
esac
exit 0
