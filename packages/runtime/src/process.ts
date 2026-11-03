// Runs one Go js/wasm program to completion against a virtual fs and tty.
// Go's runtime reads globalThis.fs / globalThis.process at startup, so only
// one process may run per realm (worker) at a time.
import "./wasm_exec.js";

declare class Go {
  argv: string[];
  env: Record<string, string>;
  exit: (code: number) => void;
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

export interface ProcessSpec {
  argv: string[];
  env: Record<string, string>;
  fs: object;
  process: object;
  tty: object;
}

const g = globalThis as Record<string, unknown>;

export async function runProcess(module: WebAssembly.Module, spec: ProcessSpec): Promise<number> {
  g.__tofuTTY = spec.tty;
  const go = new (g.Go as typeof Go)();
  go.argv = spec.argv;
  go.env = spec.env;
  let code = 0;
  go.exit = (c) => (code = c);
  const instance = await WebAssembly.instantiate(module, go.importObject);
  // Go caches globalThis.fs and globalThis.process during its synchronous
  // startup, so they only need to be swapped in for that moment.
  const saved = { fs: g.fs, process: g.process };
  Object.assign(g, { fs: spec.fs, process: spec.process });
  let done: Promise<void>;
  try {
    done = go.run(instance);
  } finally {
    Object.assign(g, saved);
  }
  await done;
  // Go leaves timers behind on exit; cancel them before they resume a dead program.
  const timers = (go as unknown as { _scheduledTimeouts: Map<number, ReturnType<typeof setTimeout>> })._scheduledTimeouts;
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  return code;
}
