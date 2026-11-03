#!/usr/bin/env bash
# Asks the freshly built binary for its function signatures and bundled
# provider schemas; the editor uses them for completion and hover.
set -euo pipefail
cd "$(dirname "$0")"
WASM=$PWD/dist/tofu.wasm
EXEC="$(go env GOROOT)/lib/wasm/wasm_exec_node.js"
tofu() { node "$EXEC" "$WASM" "$@"; }
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
tofu version -json > dist/version.json
tofu metadata functions -json > dist/functions.json
{
  echo 'terraform {'
  echo '  required_providers {'
  for p in $(ls build/providers); do echo "    $p = { source = \"hashicorp/$p\" }"; done
  echo '  }'
  echo '}'
} > "$work/main.tf"
(cd "$work" && tofu providers schema -json) > dist/schemas.json
# Keep the instance after exit so late JS callbacks hit the "already exited"
# guard instead of crashing the worker on a missing _inst.
sed "s/delete this._inst;//" "$(go env GOROOT)/lib/wasm/wasm_exec.js" > ../runtime/src/wasm_exec.js
ls -l dist
