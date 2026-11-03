// UI-side mirror of /workspace: the editor's view of every file.
import type { Entry } from "@tofu-playground/runtime";

const dec = new TextDecoder("utf-8", { fatal: false });
const ROOT = "/workspace/";

export interface WsFile {
  path: string; // relative to /workspace
  text: string;
  binary: boolean;
  size: number;
}

const editable = (p: string) => /\.(tf|tofu|tfvars|hcl|json|md|txt|tftest\.hcl)$/.test(p) || !p.includes(".");
export const isConfig = (p: string) => /\.(tf|tofu|tfvars)$/.test(p) && !p.includes("/");
export const isHidden = (p: string) => p.startsWith(".terraform/") || p.includes("/.");

export class Workspace {
  files = new Map<string, WsFile>();
  private listeners = new Set<() => void>();

  onChange(fn: () => void) {
    this.listeners.add(fn);
  }

  /** Replaces the mirror with the worker's snapshot. */
  sync(entries: Entry[]) {
    const next = new Map<string, WsFile>();
    for (const e of entries) {
      if (e.kind !== "file" || !e.path.startsWith(ROOT)) continue;
      const path = e.path.slice(ROOT.length);
      const binary = e.data.length > 2_000_000 || (!editable(path) && e.data.includes(0));
      next.set(path, { path, size: e.data.length, binary, text: binary ? "" : dec.decode(e.data) });
    }
    this.files = next;
    this.listeners.forEach((fn) => fn());
  }

  set(path: string, text: string) {
    this.files.set(path, { path, text, binary: false, size: text.length });
  }

  delete(path: string) {
    this.files.delete(path);
    this.listeners.forEach((fn) => fn());
  }

  visible(): WsFile[] {
    return [...this.files.values()].filter((f) => !isHidden(f.path)).sort((a, b) => a.path.localeCompare(b.path));
  }
}

export function toEntries(files: Record<string, string>): Entry[] {
  const enc = new TextEncoder();
  return Object.entries(files).map(([p, text]) => ({ path: ROOT + p, kind: "file", mode: 0o644, mtimeMs: Date.now(), data: enc.encode(text) }));
}
