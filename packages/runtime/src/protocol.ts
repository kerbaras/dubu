// Messages exchanged between the UI thread and the tofu worker.
import type { Entry } from "./vfs/snapshot";

export type ToWorker =
  | { t: "init"; module: WebAssembly.Module; seed: Entry[] }
  | { t: "run"; argv: string[]; cols: number; rows: number }
  | { t: "stdin"; data: string }
  | { t: "resize"; cols: number; rows: number }
  | { t: "write"; path: string; data: Uint8Array }
  | { t: "remove"; path: string }
  | { t: "reset"; seed: Entry[] };

export type FromWorker =
  | { t: "ready"; files: Entry[]; restored: boolean }
  | { t: "out"; data: Uint8Array }
  | { t: "interrupt" }
  | { t: "exit"; code: number; files: Entry[] }
  | { t: "files"; files: Entry[] }
  | { t: "error"; message: string };

export const WORKSPACE = "/workspace";
