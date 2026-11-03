// Web Worker hosting the tofu wasm binary and its sandbox filesystem.
import { createMachine, tofuEnv } from "./machine";
import { runProcess } from "./process";
import { snapshot, restore, clear, type Entry } from "./vfs/snapshot";
import { idbGet, idbSet } from "./idb";
import { WORKSPACE, type FromWorker, type ToWorker } from "./protocol";

const KEY = "workspace:v1";
const post = (m: FromWorker, transfer: Transferable[] = []) => postMessage(m, { transfer });

const machine = createMachine(
  {
    output: (data) => post({ t: "out", data }, [data.buffer as ArrayBuffer]),
    interrupt: () => post({ t: "interrupt" }),
  },
  () => schedulePersist(),
);
let module: WebAssembly.Module | undefined;
let running = false;
let persistTimer: ReturnType<typeof setTimeout> | undefined;

const workspace = (): Entry[] => snapshot(machine.tree, WORKSPACE);

function schedulePersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => void idbSet(KEY, workspace()).catch(() => {}), 250);
}

async function init(mod: WebAssembly.Module, seed: Entry[]) {
  module = mod;
  const saved = await idbGet<Entry[]>(KEY).catch(() => undefined);
  restore(machine.tree, saved?.length ? saved : seed);
  post({ t: "ready", files: workspace(), restored: !!saved?.length });
}

async function run(argv: string[], cols: number, rows: number) {
  if (running || !module) return;
  running = true;
  machine.tty.reset();
  Object.assign(machine.tty, { cols, rows });
  machine.tree.cwd = WORKSPACE;
  let code = 1;
  try {
    code = await runProcess(module, {
      argv,
      env: tofuEnv(cols, rows),
      fs: machine.fs,
      process: machine.process,
      tty: machine.tty.bridge(),
    });
  } catch (e) {
    post({ t: "out", data: new TextEncoder().encode(`\n${String(e)}\n`) });
  }
  running = false;
  machine.tty.reset();
  clearTimeout(persistTimer);
  await idbSet(KEY, workspace()).catch(() => {});
  post({ t: "exit", code, files: workspace() });
}

function write(path: string, data: Uint8Array) {
  machine.tree.mkdirp(path.slice(0, path.lastIndexOf("/")) || "/");
  restore(machine.tree, [{ path, kind: "file", mode: 0o644, mtimeMs: Date.now(), data }]);
  schedulePersist();
}

function remove(path: string) {
  const { dir, name } = machine.tree.parent(path);
  dir.children.delete(name);
  schedulePersist();
}

onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  try {
    switch (m.t) {
      case "init":
        return void init(m.module, m.seed).catch((err) => post({ t: "error", message: String(err) }));
      case "run":
        return void run(m.argv, m.cols, m.rows);
      case "stdin":
        return machine.tty.input(m.data);
      case "resize":
        return void Object.assign(machine.tty, { cols: m.cols, rows: m.rows });
      case "write":
        return write(m.path, m.data);
      case "remove":
        return remove(m.path);
      case "reset":
        clear(machine.tree, WORKSPACE);
        restore(machine.tree, m.seed);
        schedulePersist();
        return post({ t: "files", files: workspace() });
    }
  } catch (err) {
    post({ t: "error", message: String(err) });
  }
};
