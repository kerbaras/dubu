# dubu

**OpenTofu in your browser.** dubu (두부, "tofu") is a static web playground that runs the real
OpenTofu CLI, compiled to WebAssembly. You get a Monaco HCL editor on top and a terminal below, and
there is no backend.

- `tofu console`: evaluate expressions against your variables, locals, resources and data sources
- `tofu init`, `plan`, `apply`, `destroy`, `output`, `state`, `fmt`, `validate` ... the whole CLI
- Bundled providers: `hashicorp/random`, `null`, `local`, `time`, `http` (via `fetch`, so CORS applies)
- Multiple files, with files and state kept in IndexedDB
- Editor diagnostics from the real `tofu validate -json`, formatting via `tofu fmt`, completion
  and hover from the binary's own function signatures and provider schemas

## How it works

```
apps/web            Vite app: Monaco + xterm.js + a tiny sandbox shell
packages/runtime    the "OS" for Go's js/wasm port: in-memory filesystem, tty, process, worker
packages/tofu-wasm  builds the pinned OpenTofu release (go.mod) to tofu.wasm
```

- **OpenTofu is a dependency, not a fork.** `packages/tofu-wasm/go.mod` pins an OpenTofu release.
  `build.sh` vendors it and fills the js/wasm platform gaps (terminal, flock, os.Pipe, cloud SDK
  backends) with Go build overlays. To upgrade, bump the version in `go.mod` and rebuild.
- **Providers run in-process.** Provider sources are compiled into the same binary and served
  over gRPC on Go's in-memory network. OpenTofu finds them through `TF_REATTACH_PROVIDERS`, so no
  plugin processes are spawned.
- **The sandbox is the browser.** Every command runs in a fresh Go instance inside a Web Worker.
  Its syscalls go to `packages/runtime`: an in-memory POSIX-like filesystem and a tty with a line
  discipline. Ctrl-C replaces the worker. The workspace is snapshotted to IndexedDB after every
  command.

## Develop

Requires Go (version from `packages/tofu-wasm/go.mod`), Node 24 and pnpm.

```sh
pnpm install
pnpm build:wasm        # ~2 min: builds packages/tofu-wasm/dist/tofu.wasm + metadata
pnpm --filter @dubu/web sync   # copies the wasm (gzipped) into apps/web/public/tofu
pnpm dev               # http://localhost:5173
pnpm typecheck && pnpm test && pnpm build
```

`pnpm build` writes a static site to `apps/web/dist`. CI (`.github/workflows/pages.yml`) builds
everything and deploys it to GitHub Pages on `main`.

## Limits

- The binary is ~140 MB (~25 MB gzipped). It downloads once, then the browser caches it.
- No cloud providers or remote state backends: there are no plugin processes, and cloud SDKs
  don't build for js/wasm.
- The `http` provider and data sources can only reach CORS-enabled endpoints.
