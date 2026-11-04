// Lightweight scan of HCL sources for declared names (variables, locals,
// resources, ...). Used for reference completion and the outline; real
// validation is done by `tofu validate`.
export type SymbolKind = "variable" | "local" | "resource" | "data" | "module" | "output" | "provider";

export interface Sym {
  kind: SymbolKind;
  type?: string;
  name: string;
  file: string;
  line: number;
}

const blockRe = /^(resource|data|variable|output|module|provider)\s+"([^"]+)"(?:\s+"([^"]+)")?\s*\{/;
const attrRe = /^\s*([A-Za-z_][\w-]*)\s*=(?!=)/;

export function scanSymbols(file: string, text: string): Sym[] {
  const out: Sym[] = [];
  const lines = text.split("\n");
  let depth = 0;
  let inLocals = false;
  lines.forEach((raw, i) => {
    const line = raw.replace(/#.*$|\/\/.*$/, "");
    if (depth === 0) {
      const m = blockRe.exec(line.trim());
      if (m) {
        const [, kw, a, b] = m;
        const kind = kw as SymbolKind;
        out.push(b ? { kind, type: a, name: b, file, line: i + 1 } : { kind, name: a, file, line: i + 1 });
      }
      inLocals = /^\s*locals\s*\{/.test(line);
    } else if (depth === 1 && inLocals) {
      const m = attrRe.exec(line);
      if (m) out.push({ kind: "local", name: m[1], file, line: i + 1 });
    }
    for (const ch of line.replace(/"(?:[^"\\]|\\.)*"/g, '""')) {
      if (ch === "{" || ch === "[" || ch === "(") depth++;
      else if (ch === "}" || ch === "]" || ch === ")") depth = Math.max(0, depth - 1);
    }
  });
  return out;
}
