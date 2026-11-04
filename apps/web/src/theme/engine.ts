// Applies a VS Code theme everywhere: Monaco (via shiki's TextMate tokenizer),
// the app chrome (CSS variables) and the xterm palette.
import * as monaco from "monaco-editor";
import type { Terminal } from "@xterm/xterm";
import { createHighlighterCore, type HighlighterCore, type LanguageRegistration } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { bundledLanguages } from "shiki/langs";
import { shikiToMonaco } from "@shikijs/monaco";
import { dubuTheme } from "./dubu";
import { loadTheme } from "./catalog";
import { palette, type Scheme } from "./palette";
import { HCL } from "../editor/hcl-language";

export const VARS_KEY = "theme.vars";
const native = { setTheme: monaco.editor.setTheme, create: monaco.editor.create };
let highlighter: HighlighterCore;

/** HashiCorp's TextMate grammar (the one VS Code uses for .tf files), registered as Monaco's `hcl`. */
async function hclGrammar(): Promise<LanguageRegistration[]> {
  const langs = (await bundledLanguages.terraform()).default as LanguageRegistration[];
  return langs.map((l) => (l.name === "terraform" ? { ...l, name: HCL, aliases: [] } : l));
}

export async function initHighlighter() {
  highlighter = await createHighlighterCore({
    langs: [hclGrammar(), bundledLanguages.json()],
    themes: [dubuTheme],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  });
}

/** shikiToMonaco only knows the themes loaded when it runs, so rebind from Monaco's originals each time. */
function bind() {
  monaco.editor.setTheme = native.setTheme;
  monaco.editor.create = native.create;
  shikiToMonaco(highlighter, monaco);
}

export async function applyTheme(id: string, term: Terminal): Promise<Scheme> {
  const theme = await loadTheme(id);
  const name = theme.name ?? id;
  if (id.startsWith("custom-") || !highlighter.getLoadedThemes().includes(name)) {
    await highlighter.loadTheme(theme);
    bind();
  }
  monaco.editor.setTheme(name);
  const p = palette(highlighter.getTheme(name));
  const root = document.documentElement;
  for (const [k, v] of Object.entries(p.vars)) root.style.setProperty(k, v);
  root.style.colorScheme = p.scheme;
  localStorage.setItem(VARS_KEY, JSON.stringify({ ...p.vars, "color-scheme": p.scheme }));
  term.options.theme = p.terminal;
  return p.scheme;
}
