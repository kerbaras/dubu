#!/usr/bin/env bash
# Builds the unmodified OpenTofu CLI (pinned in go.mod) for js/wasm.
# Platform gaps are filled with Go build overlays instead of a fork.
set -euo pipefail
cd "$(dirname "$0")"
OUT=${1:-dist/tofu.wasm}
GEN=build/overlay
mkdir -p "$GEN" "$(dirname "$OUT")"
GOFLAGS=-mod=mod ./gen-providers.sh
# Overlays may not touch GOMODCACHE, so build from a vendored copy.
go mod vendor
export GOOS=js GOARCH=wasm GOFLAGS=-mod=vendor

dir() { echo "$PWD/vendor/$1"; }
TOFU=$(dir github.com/opentofu/opentofu)

# Cloud-SDK state backends do not build for js and add tens of MB.
grep -vE 'backend(Azure|Consul|Cos|GCS|Kubernetes|OSS|Pg|S3)' \
  "$TOFU/internal/backend/init/init.go" > "$GEN/backend_init.go"

# Cloud KMS key providers pull in the same SDKs; pbkdf2/openbao/external stay.
perl -0pe 's/^\s*"[^"]*keyprovider\/(aws_kms|gcp_kms|azure_vault)"\n//mg; s/^\s*if err := DefaultRegistry\.RegisterKeyProvider\((aws_kms|gcp_kms|azure_vault)\.New\(\)\).*?\n\s*}\n//msg' \
  "$TOFU/internal/encryption/default_registry.go" > "$GEN/default_registry.go"

# go-userdirs panics on unknown OSes; the browser sandbox is XDG-shaped.
UD=$(dir github.com/apparentlymart/go-userdirs/userdirs)
sed '/^\/\/ +build/d' "$UD/app_unix.go" > "$GEN/userdirs_js.go"

# go-plugin needs os.Pipe for stdio forwarding, which in-process providers skip.
GP=$(dir github.com/hashicorp/go-plugin)
sed "s/os\.Pipe()/pluginPipe()/" "$GP/server.go" > "$GEN/goplugin_server.go"

# In-process provider logs would otherwise flood the terminal.
PL=$(dir github.com/hashicorp/terraform-plugin-log)/internal/logging
sed "s/Stderr = os\.Stderr/Stderr = providerStderr(os.Stderr)/" "$PL/log.go" > "$GEN/pluginlog.go"

entries=(
  "$(dir golang.org/x/term)/term_unsupported.go=overlay/term_js.go"
  "$(dir github.com/chzyer/readline)/readline_js.go=overlay/readline_js.go"
  "$(dir github.com/bgentry/speakeasy)/speakeasy_js.go=overlay/speakeasy_js.go"
  "$(dir github.com/armon/go-metrics)/const_unix.go=overlay/metrics_js.go"
  "$TOFU/internal/flock/filesystem_lock_unix.go=overlay/flock_js.go"
  "$TOFU/internal/backend/init/init.go=$GEN/backend_init.go"
  "$TOFU/internal/encryption/default_registry.go=$GEN/default_registry.go"
  "$UD/app_stub.go=$GEN/userdirs_js.go"
  "$GP/server.go=$GEN/goplugin_server.go"
  "$GP/pipe_js.go=overlay/goplugin_pipe_js.go"
  "$PL/log.go=$GEN/pluginlog.go"
  "$PL/stderr_js.go=overlay/pluginlog_stderr_js.go"
  "$TOFU/cmd/tofu/playground_js.go=overlay/playground_js.go"
)
{
  echo '{"Replace":{'
  sep=""
  for e in "${entries[@]}"; do
    printf '%s"%s":"%s"' "$sep" "${e%%=*}" "$PWD/${e#*=}"
    sep=","
  done
  echo '}}'
} > build/overlay.json

go build -trimpath -ldflags="-s -w -X github.com/opentofu/opentofu/version.dev=no -X google.golang.org/protobuf/reflect/protoregistry.conflictPolicy=ignore" -overlay build/overlay.json -o "$OUT" github.com/opentofu/opentofu/cmd/tofu
ls -lh "$OUT"
./gen-metadata.sh
