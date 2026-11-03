// Web Worker hosting the tofu wasm binary and its sandbox filesystem.
import { createMachine, tofuEnv } from "./machine";
import { runProcess } from "./process";
import { snapshot, restore, clear, type Entry } from "./vfs/snapshot";
import { idbGet, idbSet } from "./idb";
import { WORKSPACE, type Edit, type FromWorker, type ToWorker } from "./protocol";

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
let persist = true;
let persistTimer: ReturnType<typeof setTimeout> | undefined;

const workspace = (): Entry[] => snapshot(machine.tree, WORKSPACE);

function schedulePersist() {
  if (!persist) return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => void idbSet(KEY, workspace()).catch(() => {}), 250);
}

async function init(mod: WebAssembly.Module, seed: Entry[], keep: boolean, edits: Edit[]) {
  module = mod;
  persist = keep;
  const saved = keep ? await idbGet<Entry[]>(KEY).catch(() => undefined) : undefined;
  restore(machine.tree, saved?.length ? saved : seed);
  for (const { path, data } of edits) data ? write(path, data) : remove(path);
  post({ t: "ready", files: workspace(), restored: !!saved?.length });
}

async function run(argv: string[], cols: number, rows: number, stdin?: string) {
  if (running || !module) return;
  running = true;
  machine.tty.reset();
  Object.assign(machine.tty, { cols, rows });
  if (stdin !== undefined) machine.tty.preload(stdin);
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
  if (persist) await idbSet(KEY, workspace()).catch(() => {});
  post({ t: "exit", code, files: workspace() });
}

function write(path: string, data: Uint8Array) {
  machine.tree.mkdirp(path.slice(0, path.lastIndexOf("/")) || "/");
  restore(machine.tree, [{ path, kind: "file", mode: 0o644, mtimeMs: Date.now(), data }]);
  schedulePersist();
}

function remove(path: string) {
  const { dir, name } = machine.tree.parent(path);
  if (!dir.children.delete(name)) return;
  schedulePersist();
}

// Every message waits for init, so nothing races the IndexedDB restore.
let booted = Promise.resolve();

onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  if (m.t === "init") {
    booted = init(m.module, m.seed, m.persist, m.edits).catch((err) => post({ t: "error", message: String(err) }));
    return;
  }
  void booted.then(() => handle(m));
};

function handle(m: Exclude<ToWorker, { t: "init" }>) {
  try {
    switch (m.t) {
      case "run":
        return void run(m.argv, m.cols, m.rows, m.stdin);
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
