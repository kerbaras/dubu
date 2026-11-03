// Runs the real `tofu validate -json` and `tofu fmt -` in a separate,
// non-persistent worker so diagnostics never block the terminal.
import * as monaco from "monaco-editor";
import type { TofuHost } from "@tofu-playground/runtime";

interface Diag {
  severity: "error" | "warning";
  summary: string;
  detail?: string;
  range?: { filename: string; start: { line: number; column: number }; end: { line: number; column: number } };
}

export class Analyzer {
  private out: string[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private timer?: ReturnType<typeof setTimeout>;
  private dec = new TextDecoder();

  constructor(private host: TofuHost) {}

  /** Receives the analysis host's output. */
  capture(data: Uint8Array) {
    this.out.push(this.dec.decode(data, { stream: true }));
  }

  private exec(argv: string[], stdin?: string): Promise<{ code: number; out: string }> {
    const job = this.queue.then(async () => {
      this.out = [];
      const code = await this.host.run(["tofu", ...argv], 120, 40, stdin);
      return { code, out: this.out.join("") };
    });
    this.queue = job.catch(() => undefined);
    return job;
  }

  schedule(files: Map<string, string>, apply: (byFile: Map<string, monaco.editor.IMarkerData[]>) => void) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.validate(files, apply), 500);
  }

  private async validate(files: Map<string, string>, apply: (byFile: Map<string, monaco.editor.IMarkerData[]>) => void) {
    this.host.reset([]);
    for (const [p, text] of files) this.host.writeFile(`/workspace/${p}`, text);
    const { out } = await this.exec(["validate", "-json", "-no-color"]);
    const start = out.indexOf("{");
    if (start < 0) return;
    let diags: Diag[] = [];
    try {
      diags = JSON.parse(out.slice(start)).diagnostics ?? [];
    } catch {
      return;
    }
    const byFile = new Map<string, monaco.editor.IMarkerData[]>([...files.keys()].map((f) => [f, []]));
    for (const d of diags) {
      const file = d.range?.filename ?? [...files.keys()][0];
      const r = d.range ?? { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } };
      byFile.get(file)?.push({
        severity: d.severity === "error" ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
        message: d.detail ? `${d.summary}\n\n${d.detail}` : d.summary,
        source: "tofu validate",
        startLineNumber: r.start.line,
        startColumn: r.start.column,
        endLineNumber: r.end.line,
        endColumn: Math.max(r.end.column, r.start.column + 1),
      });
    }
    apply(byFile);
  }

  async format(text: string): Promise<string | undefined> {
    const { code, out } = await this.exec(["fmt", "-no-color", "-"], text);
    return code === 0 ? out : undefined;
  }
}
