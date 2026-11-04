// Command palette, quick-open and the VS Code-style shortcuts that drive them.
import type { Terminal } from "@xterm/xterm";
import { Keymap, isMac, label, listen, type Binding } from "./keymap";
import { quickPick } from "./quick-pick";
import { activeId, catalog, prefs } from "../theme/catalog";
import type { Layout } from "./layout";
import type { Shell } from "../terminal/shell";
import type { EditorPane } from "../editor/editor";
import type { Workspace } from "../workspace/store";
import type { wireThemes } from "./theme-picker";
import { toast } from "./toast";

type Ctx = { terminal: boolean };
interface Command {
  title: string;
  keys?: string[];
  run(): void;
  when?(ctx: Ctx, key: string): boolean;
}

export interface CommandDeps {
  ui: Layout;
  term: Terminal;
  shell: Shell;
  editor: EditorPane;
  ws: Workspace;
  themes: ReturnType<typeof wireThemes>;
  open(path: string): void;
  newFile(): void;
  reset(): void;
}

function toggler(key: string, apply: (on: boolean) => void) {
  let on = localStorage.getItem(key) !== "0";
  apply(on);
  return (show = !on) => {
    on = show;
    localStorage.setItem(key, on ? "1" : "0");
    apply(on);
  };
}

export function wireCommands(d: CommandDeps) {
  const { ui, term, shell, editor } = d;
  let flex = ui.editorPane.style.flex;
  const terminal = toggler("view.terminal", (on) => {
    if (!on && ui.termSection.style.display !== "none") flex = ui.editorPane.style.flex;
    ui.termSection.style.display = ui.split.style.display = on ? "" : "none";
    ui.editorPane.style.flex = on ? flex : "1 1 auto";
  });
  const sidebar = toggler("view.sidebar", (on) => (ui.sidebar.style.display = on ? "" : "none"));
  const tofu = (cmd: string) => () => (terminal(true), void shell.type(cmd).then(() => term.focus()));

  const sendToConsole = () => {
    const ed = editor.editor;
    const sel = ed.getSelection();
    const model = ed.getModel();
    if (!sel || !model) return;
    const text = (sel.isEmpty() ? model.getLineContent(sel.startLineNumber) : model.getValueInRange(sel)).trim();
    if (!text) return;
    terminal(true);
    if (!shell.evaluate(text)) toast("A command is running; wait for it or press Ctrl-C in the terminal.", true);
  };

  const themePick = () => {
    const list = catalog();
    const current = activeId(prefs());
    quickPick(
      list.map((t) => ({ label: t.label, detail: `${t.scheme}${t.custom ? " · imported" : ""}`, data: t.id, run: () => d.themes.choose(t.id) })),
      { placeholder: "Select color theme (↑↓ to preview)", active: list.findIndex((t) => t.id === current), onFocus: (it) => it.data && d.themes.preview(it.data), onCancel: d.themes.revert },
    );
  };
  const goToFile = () =>
    quickPick(
      d.ws.visible().filter((f) => !f.binary).map((f) => ({ label: f.path, run: () => d.open(f.path) })),
      { placeholder: "Go to file", active: 0 },
    );

  const commands: Command[] = [
    { title: "Show All Commands", keys: ["mod+shift+p", "f1"], run: () => palette() },
    { title: "Go to File…", keys: ["mod+p"], run: goToFile },
    { title: "File: New File", keys: ["mod+n", "alt+n"], run: d.newFile },
    { title: "File: Close Tab", keys: ["alt+w", "mod+w"], run: () => editor.active && editor.close(editor.active, d.open) },
    { title: "View: Toggle Sidebar", keys: ["mod+l", "mod+b"], run: () => sidebar(), when: (c, k) => isMac || k !== "mod+l" || !c.terminal },
    { title: "View: Toggle Terminal", keys: ["mod+j", isMac ? "ctrl+`" : "mod+`"], run: () => (terminal(), ui.termSection.style.display === "none" ? editor.editor.focus() : term.focus()) },
    { title: "Terminal: Clear", keys: ["mod+k"], run: () => term.clear() },
    { title: "Editor: Format Document", keys: ["mod+s"], run: () => void editor.editor.getAction("editor.action.formatDocument")?.run() },
    { title: "Editor: Evaluate Selection in tofu console", keys: ["mod+enter"], run: sendToConsole, when: (c) => !c.terminal },
    { title: "Preferences: Color Theme", keys: ["mod+k mod+t"], run: themePick },
    { title: "Preferences: Import VS Code Theme…", run: d.themes.importFile },
    { title: "Preferences: Follow System Light/Dark", run: () => d.themes.setMode("system") },
    { title: "Preferences: Use Light Theme", run: () => d.themes.setMode("light") },
    { title: "Preferences: Use Dark Theme", run: () => d.themes.setMode("dark") },
    ...["console", "init", "plan", "apply", "destroy", "validate", "fmt", "output", "state list"].map((c) => ({ title: `Tofu: ${c}`, run: tofu(`tofu ${c}`) })),
    { title: "Workspace: Reset to Example", run: () => confirm("Reset files and state to the example?") && d.reset() },
  ];

  function palette() {
    quickPick(
      commands.filter((c) => c.title !== "Show All Commands").map((c) => ({ label: c.title, hint: c.keys && label(c.keys[0]), run: c.run })),
      { placeholder: "Type a command" },
    );
  }

  const bindings: Binding<Ctx>[] = commands.flatMap((c) => (c.keys ?? []).map((k) => ({ keys: [k], run: c.run, when: c.when && ((ctx: Ctx) => c.when!(ctx, k)) })));
  listen(new Keymap(bindings), () => ({ terminal: ui.terminal.contains(document.activeElement) }));
  ui.paletteKeys.textContent = label("mod+shift+p");
  ui.paletteBtn.addEventListener("click", palette);
  return { palette, themePick };
}
