import "./styles.css";
import * as monaco from "monaco-editor";
import { TofuHost, loadModule } from "@dubu/runtime";
import TofuWorker from "@dubu/runtime/worker?worker";
import { mountLayout, wireSplitter } from "./ui/layout";
import { renderFiles, renderOutline } from "./ui/sidebar";
import { registerHcl } from "./editor/hcl-language";
import { initHighlighter } from "./theme/engine";
import { loadCustom } from "./theme/catalog";
import { wireThemes } from "./ui/theme-picker";
import { wireCommands } from "./ui/commands";
import { EditorPane } from "./editor/editor";
import { loadMetadata } from "./editor/metadata";
import { registerCompletion } from "./editor/completion";
import { scanSymbols, type Sym } from "./editor/symbols";
import { Analyzer } from "./editor/diagnostics";
import { createTerminal } from "./terminal/terminal";
import { Shell } from "./terminal/shell";
import { Workspace, isConfig, toEntries } from "./workspace/store";
import { examples } from "./workspace/examples";

const BASE = `${import.meta.env.BASE_URL}tofu/`;
const ui = mountLayout(document.querySelector("#app")!);
wireSplitter(ui.split, ui.editorPane);
registerHcl();

const ws = new Workspace();
let symbols: Sym[] = [];
const exampleId = () => localStorage.getItem("example") ?? examples[0].id;
const seed = () => toEntries((examples.find((e) => e.id === exampleId()) ?? examples[0]).files);
const configFiles = () => new Map([...ws.files.values()].filter((f) => isConfig(f.path)).map((f) => [f.path, f.text]));

const term = createTerminal(ui.terminal);
await Promise.all([initHighlighter(), loadCustom()]);
const themes = wireThemes(ui.themeBtn, term);
await themes.refresh();
let host: TofuHost;
let analyzer: Analyzer;
const shell = new Shell(term, {
  host: () => host,
  ws,
  removeFile: (p) => removeFile(p),
  reset: () => void resetWorkspace(),
  onBusy: (cmd) => {
    ui.termStatus.textContent = cmd ? `running · ${cmd}` : "sandbox";
    ui.dot.className = `size-2 rounded-full ${cmd ? "bg-tofu animate-pulse" : "bg-ok"}`;
    ui.runtimeText.textContent = cmd ? "running" : "ready";
  },
});
term.onData((d) => shell.input(d));
term.onResize(({ cols, rows }) => host?.resize(cols, rows));
ui.termClear.addEventListener("click", () => (term.clear(), term.focus()));

const editor = new EditorPane(
  ui.editor,
  ui.tabs,
  (path, text) => {
    ws.set(path, text);
    host.writeFile(`/workspace/${path}`, text);
    refreshSymbols();
    analyze();
  },
  () => renderFiles(ui.files, ws.visible(), editor.active),
);
editor.editor.onDidChangeCursorPosition((e) => (ui.cursor.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`));

function removeFile(path: string) {
  host.removeFile(`/workspace/${path}`);
  ws.delete(path);
  editor.drop(path, open);
  renderFiles(ui.files, ws.visible(), editor.active);
  refreshSymbols();
  analyze();
}

function open(path: string) {
  const f = ws.files.get(path);
  if (f && !f.binary) editor.show(path, f.text);
}

function refreshSymbols() {
  symbols = [...configFiles()].flatMap(([p, t]) => scanSymbols(p, t));
  renderOutline(ui.outline, symbols);
}

function analyze() {
  analyzer?.schedule(configFiles(), (byFile) => {
    let errors = 0;
    let warnings = 0;
    for (const [file, markers] of byFile) {
      editor.markers(file, markers);
      for (const m of markers) m.severity === monaco.MarkerSeverity.Error ? errors++ : warnings++;
    }
    ui.diags.textContent = errors || warnings ? `✕ ${errors}  ⚠ ${warnings}` : "✓ valid";
    ui.diags.className = errors ? "text-bad" : warnings ? "text-tofu" : "text-ok";
  });
}

ws.onChange(() => {
  for (const p of editor.open) {
    const f = ws.files.get(p);
    if (f) editor.model(p, f.text);
    else editor.drop(p, open);
  }
  renderFiles(ui.files, ws.visible(), editor.active);
  refreshSymbols();
  analyze();
});

ui.files.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-path]");
  if (!btn) return;
  if (btn.hasAttribute("data-del")) return void (confirm(`Delete ${btn.dataset.path}?`) && removeFile(btn.dataset.path!));
  open(btn.dataset.path!);
});
ui.outline.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-file]");
  if (!btn) return;
  open(btn.dataset.file!);
  const line = Number(btn.dataset.line);
  editor.editor.revealLineInCenter(line);
  editor.editor.setPosition({ lineNumber: line, column: 1 });
  editor.editor.focus();
});
ui.tabs.addEventListener("click", (e) => {
  const tab = (e.target as HTMLElement).closest<HTMLElement>("[data-path]");
  if (!tab) return;
  if ((e.target as HTMLElement).closest("button")) editor.close(tab.dataset.path!, open);
  else open(tab.dataset.path!);
});
function newFile() {
  const name = prompt("New file name", "outputs.tf")?.trim();
  if (!name || !/^[\w.-]+$/.test(name)) return;
  ws.set(name, "");
  host.writeFile(`/workspace/${name}`, "");
  renderFiles(ui.files, ws.visible(), editor.active);
  open(name);
}
ui.newFile.addEventListener("click", newFile);
wireCommands({ ui, term, shell, editor, ws, themes, open, newFile, reset: () => void resetWorkspace() });
ui.commands.forEach((b) => b.addEventListener("click", () => void shell.type(b.dataset.cmd!).then(() => term.focus())));
ui.example.value = exampleId();
ui.example.addEventListener("change", () => {
  if (!confirm("Load this example? Current files and state are replaced.")) return void (ui.example.value = exampleId());
  localStorage.setItem("example", ui.example.value);
  void resetWorkspace();
});

async function resetWorkspace() {
  if (shell.running) host.interrupt();
  host.reset(seed());
  for (const p of [...editor.open]) editor.drop(p, () => {});
  setTimeout(() => {
    open(ws.visible().find((f) => isConfig(f.path))?.path ?? "main.tf");
    term.write("\x1b[2mworkspace reset\x1b[0m\r\n");
  }, 100);
}

const fmtMb = (n: number) => (n / 1048576).toFixed(1);

async function boot() {
  const manifest = await fetch(`${BASE}manifest.json`).then((r) => r.json());
  ui.version.textContent = `OpenTofu v${manifest.version}`;
  term.write(`\x1b[1mdubu\x1b[0m \x1b[2m· OpenTofu v${manifest.version} compiled to WebAssembly, running in your browser\x1b[0m\r\n`);
  const [module, meta] = await Promise.all([
    loadModule(`${BASE}tofu.wasm.gz`, manifest.gzipSize, (n, t) => {
      term.write(`\r\x1b[2K\x1b[2mdownloading tofu.wasm ${fmtMb(n)} / ${fmtMb(t)} MB\x1b[0m`);
      ui.runtimeText.textContent = `loading ${Math.round((n / t) * 100)}%`;
    }),
    loadMetadata(BASE),
  ]);
  term.write("\r\x1b[2K");
  registerCompletion(meta, () => symbols);
  analyzer = new Analyzer(new TofuHost(module, () => new TofuWorker(), () => [], { output: (d) => analyzer.capture(d), files: () => {}, ready: () => {}, error: console.error }, false));
  monaco.languages.registerDocumentFormattingEditProvider("hcl", {
    provideDocumentFormattingEdits: async (model) => {
      const out = await analyzer.format(model.getValue());
      return out === undefined ? [] : [{ range: model.getFullModelRange(), text: out }];
    },
  });
  await new Promise<void>((resolve) => {
    host = new TofuHost(module, () => new TofuWorker(), seed, {
      output: (d) => shell.output(d),
      files: (f) => ws.sync(f),
      ready: () => resolve(),
      error: (m) => term.write(`\x1b[31m${m}\x1b[0m\r\n`),
    });
  });
  open(editor.active ?? ws.visible().find((f) => isConfig(f.path))?.path ?? "main.tf");
  analyze();
  ui.dot.className = "size-2 rounded-full bg-ok";
  ui.runtimeText.textContent = "ready";
  term.write("\x1b[2mType \x1b[0;33mhelp\x1b[0;2m for commands. Starting \x1b[0;33mtofu console\x1b[0;2m (Ctrl-D returns to the shell).\x1b[0m\r\n");
  term.focus();
  await shell.type("tofu console");
}

boot().catch((e) => term.write(`\r\n\x1b[31mfailed to start: ${e}\x1b[0m\r\n`));
