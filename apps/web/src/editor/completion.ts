// Completion and hover backed by the binary's own function list and the
// bundled providers' schemas, plus names declared in the workspace.
import * as monaco from "monaco-editor";
import { HCL } from "./hcl-language";
import { fnSignature, typeName, type Block, type Metadata } from "./metadata";
import type { Sym } from "./symbols";

const K = monaco.languages.CompletionItemKind;
const topLevel = ["resource", "data", "variable", "locals", "output", "module", "provider", "terraform", "moved", "import", "check"];

const blockAt = (model: monaco.editor.ITextModel, line: number) => {
  for (let l = line; l > 0; l--) {
    const m = /^(resource|data)\s+"([^"]+)"/.exec(model.getLineContent(l));
    if (m) return { kind: m[1], type: m[2] };
    if (/^\S.*\{\s*$/.test(model.getLineContent(l)) && l !== line) return undefined;
  }
};

function attrItems(block: Block, range: monaco.IRange): monaco.languages.CompletionItem[] {
  return Object.entries(block.attributes ?? {})
    .filter(([, a]) => !(a.computed && !a.optional))
    .map(([name, a]) => ({
      label: { label: name, description: `${a.required ? "required " : ""}${typeName(a.type)}` },
      kind: K.Property,
      insertText: `${name} = `,
      documentation: a.description,
      sortText: a.required ? `0${name}` : `1${name}`,
      range,
    }));
}

export function registerCompletion(meta: Metadata, symbols: () => Sym[]) {
  monaco.languages.registerCompletionItemProvider(HCL, {
    triggerCharacters: [".", '"'],
    provideCompletionItems(model, pos) {
      const word = model.getWordUntilPosition(pos);
      const range = { startLineNumber: pos.lineNumber, endLineNumber: pos.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
      const before = model.getLineContent(pos.lineNumber).slice(0, word.startColumn - 1);
      const syms = symbols();
      const item = (label: string, kind: monaco.languages.CompletionItemKind, detail?: string) => ({ label, kind, detail, insertText: label, range });

      const typeCtx = /^(resource|data)\s+"$/.exec(before);
      if (typeCtx) {
        const src = typeCtx[1] === "resource" ? meta.resources : meta.dataSources;
        return { suggestions: Object.entries(src).map(([t, s]) => ({ ...item(t, K.Class), documentation: s.block.description })) };
      }
      const ref = /(?:^|[^\w.])([\w-]+(?:\.[\w-]+)?)\.$/.exec(before);
      if (ref) {
        const [root, sub] = ref[1].split(".");
        const pick = (kind: Sym["kind"]) => syms.filter((s) => s.kind === kind);
        if (root === "var") return { suggestions: pick("variable").map((s) => item(s.name, K.Variable, "variable")) };
        if (root === "local") return { suggestions: pick("local").map((s) => item(s.name, K.Variable, "local")) };
        if (root === "module") return { suggestions: pick("module").map((s) => item(s.name, K.Module, "module")) };
        if (root === "data" && !sub) return { suggestions: [...new Set(pick("data").map((s) => s.type!))].map((t) => item(t, K.Class)) };
        if (root === "data") return { suggestions: pick("data").filter((s) => s.type === sub).map((s) => item(s.name, K.Field)) };
        const res = pick("resource").filter((s) => s.type === root);
        if (res.length && !sub) return { suggestions: res.map((s) => item(s.name, K.Field, root)) };
        const schema = sub && (root === "data" ? undefined : meta.resources[root]);
        if (schema) return { suggestions: Object.entries(schema.block.attributes ?? {}).map(([n, a]) => ({ ...item(n, K.Property, typeName(a.type)), documentation: a.description })) };
        return { suggestions: [] };
      }
      const inBlock = blockAt(model, pos.lineNumber);
      const atLineStart = /^\s*$/.test(before);
      if (atLineStart && inBlock) {
        const s = (inBlock.kind === "resource" ? meta.resources : meta.dataSources)[inBlock.type];
        if (s) return { suggestions: attrItems(s.block, range) };
      }
      if (atLineStart && !before.length) {
        return { suggestions: topLevel.map((k) => item(k, K.Keyword)) };
      }
      const fns = Object.entries(meta.functions).map(([name, f]) => ({
        label: name,
        kind: K.Function,
        detail: fnSignature(name, f),
        documentation: { value: f.description ?? "" },
        insertText: `${name}($0)`,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
      }));
      const roots = ["var", "local", "module", "data", "path", "terraform", "count", "each", "self"].map((r) => item(r, K.Keyword));
      const resTypes = [...new Set(syms.filter((s) => s.kind === "resource").map((s) => s.type!))].map((t) => item(t, K.Class, "resource"));
      return { suggestions: [...roots, ...resTypes, ...fns] };
    },
  });

  monaco.languages.registerHoverProvider(HCL, {
    provideHover(model, pos) {
      const word = model.getWordAtPosition(pos);
      if (!word) return null;
      const line = model.getLineContent(pos.lineNumber);
      const range = new monaco.Range(pos.lineNumber, word.startColumn, pos.lineNumber, word.endColumn);
      const f = meta.functions[word.word];
      if (f && line[word.endColumn - 1] === "(") {
        return { range, contents: [{ value: "```hcl\n" + fnSignature(word.word, f) + "\n```" }, { value: f.description ?? "" }] };
      }
      const s = meta.resources[word.word] ?? meta.dataSources[word.word];
      if (s) return { range, contents: [{ value: `**${word.word}**` }, { value: s.block.description ?? "" }] };
      const block = blockAt(model, pos.lineNumber);
      const attr = block && (block.kind === "resource" ? meta.resources : meta.dataSources)[block.type]?.block.attributes?.[word.word];
      if (attr) return { range, contents: [{ value: `\`${word.word}\`: ${typeName(attr.type)}${attr.required ? " (required)" : ""}` }, { value: attr.description ?? "" }] };
      return null;
    },
  });
}
