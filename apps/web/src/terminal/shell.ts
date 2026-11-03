// A tiny sandbox shell: runs tofu (the real binary) plus a few file helpers.
import type { Terminal } from "@xterm/xterm";
import type { TofuHost } from "@dubu/runtime";
import { LineEditor } from "./line-editor";
import { splitArgs } from "./split-args";
import type { Workspace } from "../workspace/store";

const c = (code: string, s: string) => `\x1b[${code}m${s}\x1b[0m`;
const subcommands = ["console", "init", "plan", "apply", "destroy", "validate", "fmt", "output", "show", "state", "graph", "providers", "version", "test", "workspace", "import", "refresh", "taint", "untaint", "metadata"];
const builtins = ["tofu", "terraform", "help", "clear", "ls", "cat", "rm", "history", "reset"];

export interface ShellDeps {
  host: () => TofuHost;
  ws: Workspace;
  removeFile(path: string): void;
  reset(): void;
  onBusy(cmd: string | undefined): void;
}

export class Shell {
  private editor: LineEditor;
  private busy = false;

  constructor(
    private term: Terminal,
    private deps: ShellDeps,
  ) {
    this.editor = new LineEditor(() => `${c("38;2;255;218;24", "tofu")}${c("38;2;107;102;91", ":")}${c("38;2;143;182;255", "/workspace")}$ `, {
      write: (s) => term.write(s),
      submit: (line) => void this.exec(line),
      complete: (left) => this.complete(left),
      clear: () => term.clear(),
    });
  }

  get running() {
    return this.busy;
  }

  input(data: string) {
    if (this.busy) this.deps.host().stdin(data);
    else this.editor.input(data);
  }

  prompt() {
    this.editor.showPrompt();
  }

  /** Runs a command as if typed (used by toolbar buttons). */
  async type(line: string) {
    if (this.busy) {
      if (!line.startsWith("tofu console")) return;
      this.deps.host().interrupt();
      await new Promise((r) => setTimeout(r, 50));
    }
    this.term.write(`\r\x1b[2K${line}\r\n`);
    await this.exec(line);
  }

  private async exec(line: string) {
    const [cmd, ...args] = splitArgs(line);
    try {
      if (!cmd) return;
      if (cmd === "tofu" || cmd === "terraform") await this.tofu(args);
      else this.builtin(cmd, args);
    } finally {
      this.editor.showPrompt();
    }
  }

  private async tofu(args: string[]) {
    this.busy = true;
    this.deps.onBusy(["tofu", ...args].join(" "));
    try {
      const code = await this.deps.host().run(["tofu", ...args], this.term.cols, this.term.rows);
      if (code === 130) this.term.write(c("2", "(interrupted)\r\n"));
      else if (code !== 0) this.term.write(c("38;2;255;138;122", `exit status ${code}\r\n`));
    } finally {
      this.busy = false;
      this.deps.onBusy(undefined);
    }
  }

  private builtin(cmd: string, args: string[]) {
    const w = (s = "") => this.term.write(s.replace(/\n/g, "\r\n") + "\r\n");
    const { ws } = this.deps;
    switch (cmd) {
      case "help":
        return w(
          [
            c("1", "dubu") + " — the real OpenTofu CLI, compiled to WebAssembly.",
            "",
            `  ${c("33", "tofu console")}        evaluate expressions against your config (Ctrl-D exits)`,
            `  ${c("33", "tofu init | plan | apply | destroy | validate | fmt | output | state ...")}`,
            "  ls, cat FILE, rm FILE  inspect the sandbox workspace",
            "  clear, history, reset  reset restores the current example (state included)",
            "",
            "Bundled providers: hashicorp/random, null, local, time, http (fetch, needs CORS).",
            "Files and state live in this browser (IndexedDB). Ctrl-C stops a running command.",
          ].join("\n"),
        );
      case "clear":
        return this.term.clear();
      case "ls":
        return w(ws.visible().map((f) => (f.path.endsWith(".tf") ? c("33", f.path) : f.path)).join("\n") || c("2", "(empty)"));
      case "cat":
        return args.forEach((p) => {
          const f = ws.files.get(p.replace(/^\.\//, ""));
          w(f ? (f.binary ? c("2", `(binary, ${f.size} bytes)`) : f.text.replace(/\n$/, "")) : c("31", `cat: ${p}: no such file`));
        });
      case "rm":
        return args.forEach((p) => (ws.files.has(p) ? this.deps.removeFile(p) : w(c("31", `rm: ${p}: no such file`))));
      case "history":
        return w(c("2", "use ↑/↓ to walk history"));
      case "reset":
        return this.deps.reset();
      default:
        return w(c("31", `${cmd}: command not found`) + c("2", " (try help)"));
    }
  }

  private complete(left: string): string[] {
    const words = left.split(/\s+/);
    const word = words.at(-1) ?? "";
    const pool = words.length === 1 ? builtins : words.length === 2 && /^(tofu|terraform)$/.test(words[0]) ? subcommands : [...this.deps.ws.files.keys()];
    return pool.filter((p) => p.startsWith(word));
  }
}
