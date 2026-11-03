// HCL / OpenTofu tokenizer and language configuration for Monaco.
import * as monaco from "monaco-editor";

export const HCL = "hcl";

const blockKeywords = [
  "resource", "data", "variable", "locals", "output", "module", "provider", "terraform",
  "moved", "import", "removed", "check", "required_providers", "backend", "lifecycle",
  "dynamic", "content", "provisioner", "connection", "validation", "precondition",
  "postcondition", "encryption",
];

export function registerHcl() {
  monaco.languages.register({ id: HCL, extensions: [".tf", ".tofu", ".tfvars", ".hcl"], aliases: ["HCL", "OpenTofu"] });
  monaco.languages.setLanguageConfiguration(HCL, {
    comments: { lineComment: "#", blockComment: ["/*", "*/"] },
    brackets: [["{", "}"], ["[", "]"], ["(", ")"]],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"', notIn: ["string"] },
      { open: "${", close: "}" },
    ],
    surroundingPairs: [{ open: '"', close: '"' }, { open: "{", close: "}" }, { open: "[", close: "]" }, { open: "(", close: ")" }],
    indentationRules: { increaseIndentPattern: /[{[(]\s*$/, decreaseIndentPattern: /^\s*[}\])]/ },
    folding: { markers: { start: /^\s*#\s*region\b/, end: /^\s*#\s*endregion\b/ } },
    wordPattern: /[A-Za-z_][\w-]*/,
  });
  monaco.languages.setMonarchTokensProvider(HCL, {
    blockKeywords,
    constants: ["true", "false", "null"],
    exprKeywords: ["for", "in", "if", "else", "endif", "endfor"],
    roots: ["var", "local", "module", "data", "path", "terraform", "count", "each", "self"],
    tokenizer: {
      root: [
        [/^\s*([a-zA-Z_][\w-]*)(?=\s*(?:"[^"]*"\s*)*\{)/, { cases: { "@blockKeywords": "keyword.block", "@default": "type.block" } }],
        [/[a-zA-Z_][\w-]*(?=\s*=(?!=))/, "attribute"],
        { include: "@expr" },
      ],
      expr: [
        [/#.*$/, "comment"],
        [/\/\/.*$/, "comment"],
        [/\/\*/, "comment", "@comment"],
        [/<<-?\s*([A-Z_]+)\s*$/, { token: "string.heredoc", next: "@heredoc.$1" }],
        [/"/, "string", "@string"],
        [/\d+(\.\d+)?([eE][-+]?\d+)?/, "number"],
        [/[a-zA-Z_][\w-]*(?=\()/, "function"],
        [/[a-zA-Z_][\w-]*/, { cases: { "@constants": "constant", "@exprKeywords": "keyword", "@roots": "variable.root", "@default": "identifier" } }],
        [/[{}()[\]]/, "@brackets"],
        [/=>|==|!=|<=|>=|&&|\|\||[-+*/%<>!?:=]/, "operator"],
        [/\.\.\./, "operator"],
      ],
      comment: [[/\*\//, "comment", "@pop"], [/./, "comment"]],
      string: [
        [/\$\{|%\{/, { token: "delimiter.interp", next: "@interp" }],
        [/\\./, "string.escape"],
        [/"/, "string", "@pop"],
        [/[^"\\$%]+|[$%]/, "string"],
      ],
      interp: [[/\}/, { token: "delimiter.interp", next: "@pop" }], { include: "@expr" }],
      heredoc: [
        [/^\s*([A-Z_]+)\s*$/, { cases: { "$1==$S2": { token: "string.heredoc", next: "@pop" }, "@default": "string" } }],
        [/\$\{|%\{/, { token: "delimiter.interp", next: "@interp" }],
        [/./, "string"],
      ],
    },
  } as monaco.languages.IMonarchLanguage);
}
