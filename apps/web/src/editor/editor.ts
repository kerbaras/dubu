// Monaco editor with one model per workspace file and a tab strip.
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { HCL } from "./hcl-language";

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };

const uri = (path: string) => monaco.Uri.parse(`file:///workspace/${path}`);
const language = (path: string) => (/\.(tf|tofu|tfvars|hcl)$/.test(path) ? HCL : path.endsWith(".tfstate") || path.endsWith(".json") ? "json" : "plaintext");
export const readOnly = (path: string) => /\.tfstate(\.backup)?$|^\.terraform/.test(path);

export class EditorPane {
  editor: monaco.editor.IStandaloneCodeEditor;
  open: string[] = [];
  active?: string;
  private silent = false;

  constructor(
    host: HTMLElement,
    private tabs: HTMLElement,
    private onEdit: (path: string, text: string) => void,
    private onActive: (path: string | undefined) => void,
  ) {
    this.editor = monaco.editor.create(host, {
      fontFamily: '"JetBrains Mono Variable", ui-monospace, monospace',
      fontSize: 13.5,
      lineHeight: 22,
      fontLigatures: true,
      minimap: { enabled: false },
      automaticLayout: true,
      scrollBeyondLastLine: false,
      padding: { top: 12 },
      tabSize: 2,
      renderLineHighlight: "line",
      smoothScrolling: true,
      cursorBlinking: "smooth",
      bracketPairColorization: { enabled: true },
      guides: { indentation: true, bracketPairs: "active" },
      stickyScroll: { enabled: true },
      fixedOverflowWidgets: true,
    });
    this.editor.onDidChangeModelContent(() => {
      if (this.silent || !this.active) return;
      this.onEdit(this.active, this.editor.getValue());
    });
  }

  model(path: string, text: string) {
    let m = monaco.editor.getModel(uri(path));
    if (!m) m = monaco.editor.createModel(text, language(path), uri(path));
    else if (m.getValue() !== text) {
      this.silent = true;
      m.pushEditOperations([], [{ range: m.getFullModelRange(), text }], () => null);
      this.silent = false;
    }
    return m;
  }

  show(path: string, text: string) {
    const m = this.model(path, text);
    if (!this.open.includes(path)) this.open.push(path);
    this.active = path;
    this.silent = true;
    this.editor.setModel(m);
    this.silent = false;
    this.editor.updateOptions({ readOnly: readOnly(path) });
    this.renderTabs();
    this.onActive(path);
  }

  close(path: string, fallback: (path: string) => void) {
    this.open = this.open.filter((p) => p !== path);
    if (this.active === path) {
      this.active = undefined;
      const next = this.open.at(-1);
      if (next) fallback(next);
      else {
        this.editor.setModel(null);
        this.onActive(undefined);
      }
    }
    this.renderTabs();
  }

  drop(path: string, fallback: (path: string) => void) {
    this.close(path, fallback);
    monaco.editor.getModel(uri(path))?.dispose();
  }

  markers(path: string, markers: monaco.editor.IMarkerData[]) {
    const m = monaco.editor.getModel(uri(path));
    if (m) monaco.editor.setModelMarkers(m, "tofu", markers);
  }

  renderTabs() {
    this.tabs.replaceChildren(
      ...this.open.map((p) => {
        const tab = document.createElement("div");
        tab.className = "tab cursor-pointer";
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-selected", String(p === this.active));
        tab.tabIndex = 0;
        tab.dataset.path = p;
        tab.innerHTML = `<span class="font-mono text-[12.5px]"></span><button class="icon-btn size-5 text-xs" aria-label="Close ${p}">✕</button>`;
        tab.firstElementChild!.textContent = p;
        return tab;
      }),
    );
  }
}
