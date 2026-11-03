// UI-thread handle on the tofu worker. A process can't be interrupted from
// outside the Go runtime, so Ctrl-C on a busy process replaces the worker.
import type { Entry } from "./vfs/snapshot";
import type { FromWorker, ToWorker } from "./protocol";

export interface HostEvents {
  output(data: Uint8Array): void;
  files(files: Entry[]): void;
  ready(restored: boolean): void;
  error(message: string): void;
}

export class TofuHost {
  private worker!: Worker;
  private exitWaiter?: (code: number) => void;
  running = false;

  constructor(
    private module: WebAssembly.Module,
    private makeWorker: () => Worker,
    private seed: () => Entry[],
    private events: HostEvents,
  ) {
    this.spawn();
  }

  private spawn() {
    this.worker = this.makeWorker();
    this.worker.onmessage = (e: MessageEvent<FromWorker>) => this.handle(e.data);
    this.send({ t: "init", module: this.module, seed: this.seed() });
  }

  private send(m: ToWorker, transfer: Transferable[] = []) {
    this.worker.postMessage(m, transfer);
  }

  private handle(m: FromWorker) {
    switch (m.t) {
      case "out":
        return this.events.output(m.data);
      case "ready":
        this.events.files(m.files);
        return this.events.ready(m.restored);
      case "files":
        return this.events.files(m.files);
      case "exit":
        this.events.files(m.files);
        return this.finish(m.code);
      case "interrupt":
        return this.interrupt();
      case "error":
        return this.events.error(m.message);
    }
  }

  private finish(code: number) {
    this.running = false;
    const w = this.exitWaiter;
    this.exitWaiter = undefined;
    w?.(code);
  }

  run(argv: string[], cols: number, rows: number): Promise<number> {
    if (this.running) return Promise.reject(new Error("a process is already running"));
    this.running = true;
    return new Promise((resolve) => {
      this.exitWaiter = resolve;
      this.send({ t: "run", argv, cols, rows });
    });
  }

  stdin(data: string) {
    this.send({ t: "stdin", data });
  }

  resize(cols: number, rows: number) {
    this.send({ t: "resize", cols, rows });
  }

  writeFile(path: string, text: string) {
    const data = new TextEncoder().encode(text);
    this.send({ t: "write", path, data }, [data.buffer]);
  }

  removeFile(path: string) {
    this.send({ t: "remove", path });
  }

  reset(seed: Entry[]) {
    this.send({ t: "reset", seed });
  }

  /** Kills the running process by replacing the worker; files persist in IndexedDB. */
  interrupt() {
    if (!this.running) return;
    this.worker.terminate();
    this.spawn();
    this.finish(130);
  }
}
