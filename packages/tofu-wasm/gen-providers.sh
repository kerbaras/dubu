#!/usr/bin/env bash
# Copies the pinned upstream providers' sources into build/providers so they can
# be linked into the tofu binary (Go forbids importing another module's
# internal/ packages). Only import paths are rewritten.
set -euo pipefail
cd "$(dirname "$0")"
SELF=github.com/opentofu/opentofu/playground/build/providers
rm -rf build/providers
for mod in $(go list -m -f '{{.Path}}' all | grep '/terraform-provider-'); do
  name=${mod##*-}
  go mod download "$mod"
  src=$(go list -m -f '{{.Dir}}' "$mod")/internal
  dst=build/providers/$name
  mkdir -p "$dst"
  (cd "$src" && find . -name '*.go' ! -name '*_test.go' ! -path '*/testdata/*' ! -path '*test*/*') |
    while read -r f; do
      mkdir -p "$dst/$(dirname "$f")"
      sed "s#\"$mod/internal/#\"$SELF/$name/#g" "$src/$f" > "$dst/$f"
    done
  chmod -R u+w "$dst"
done
ls build/providers
