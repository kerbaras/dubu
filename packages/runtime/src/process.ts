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
  g.fs = spec.fs;
  g.process = spec.process;
  g.__tofuTTY = spec.tty;
  const go = new (g.Go as typeof Go)();
  go.argv = spec.argv;
  go.env = spec.env;
  let code = 0;
  go.exit = (c) => (code = c);
  const instance = await WebAssembly.instantiate(module, go.importObject);
  await go.run(instance);
  return code;
}
