// HCL / OpenTofu language configuration for Monaco (tokens come from the TextMate grammar in theme/engine.ts).
import * as monaco from "monaco-editor";

export const HCL = "hcl";

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
}
