// Static app shell. Returns the elements the controllers attach to.
import { examples } from "../workspace/examples";

const html = String.raw;

export function mountLayout(root: HTMLElement) {
  root.innerHTML = html`
    <div class="flex h-full flex-col">
      <header class="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-panel px-3">
        <div class="flex items-center gap-2">
          <svg viewBox="0 0 28 28" class="size-7" aria-hidden="true"><rect width="28" height="28" rx="7" fill="#ffda18"/><path d="M8 11.5 14 8l6 3.5v6L14 21l-6-3.5z" fill="#fff6c2" stroke="#1a1700" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 11.5 14 15l6-3.5M14 15v6" fill="none" stroke="#1a1700" stroke-width="1.6" stroke-linejoin="round"/></svg>
          <span class="text-[15px] font-semibold tracking-tight">dubu</span>
        </div>
        <span class="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-muted" id="version">loading…</span>
        <label class="ml-2 flex items-center gap-2 text-[12px] text-muted">
          <span class="sr-only sm:not-sr-only">Example</span>
          <select id="example" class="h-8 rounded-md border border-line bg-bg px-2 text-[13px] text-ink">
            ${examples.map((e) => `<option value="${e.id}">${e.title}</option>`).join("")}
          </select>
        </label>
        <div class="ml-auto flex items-center gap-2">
          <button id="theme-btn" class="icon-btn size-8" aria-label="Theme" title="Theme (Ctrl+K Ctrl+T)"><svg viewBox="0 0 16 16" class="size-4" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11a5.5 5.5 0 0 0 0-11z" fill="currentColor"/></svg></button>
          <button class="btn" data-cmd="tofu console" title="Restart the console with the current files">Console</button>
          <button class="btn" data-cmd="tofu init">Init</button>
          <button class="btn" data-cmd="tofu plan">Plan</button>
          <button class="btn btn-primary" data-cmd="tofu apply">▶ Apply</button>
        </div>
      </header>
      <div class="flex min-h-0 flex-1">
        <main class="flex min-w-0 flex-1 flex-col">
          <div id="editor-pane" class="flex min-h-0 flex-col" style="flex: 0 0 58%">
            <div id="tabs" role="tablist" class="flex h-9 shrink-0 overflow-x-auto border-b border-line bg-panel"></div>
            <div id="editor" class="min-h-0 flex-1"></div>
          </div>
          <div id="split" class="splitter h-px cursor-row-resize" role="separator" aria-orientation="horizontal" tabindex="0" aria-label="Resize terminal"></div>
          <section id="term-section" class="flex min-h-0 flex-1 flex-col bg-bg" aria-label="Terminal">
            <div class="flex h-9 shrink-0 items-center gap-3 border-b border-line px-3 text-[12px]">
              <span class="font-medium text-ink">Terminal</span>
              <span id="term-status" class="font-mono text-faint">sandbox</span>
              <button id="term-clear" class="icon-btn ml-auto" aria-label="Clear terminal" title="Clear"><svg viewBox="0 0 16 16" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 4h10M6 4V2.5h4V4M4.5 4l.7 9.5h5.6l.7-9.5"/></svg></button>
            </div>
            <div id="terminal" class="min-h-0 flex-1 pl-3 pt-2"></div>
          </section>
        </main>
        <aside id="sidebar" class="hidden w-60 shrink-0 flex-col border-l border-line bg-panel md:flex" aria-label="Files">
          <div class="flex h-9 items-center justify-between border-b border-line px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <span>Workspace</span>
            <button id="new-file" class="icon-btn" aria-label="New file" title="New file"><svg viewBox="0 0 16 16" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg></button>
          </div>
          <ul id="files" class="flex-1 overflow-y-auto py-1 text-[13px]"></ul>
          <div id="outline-head" class="border-t border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Outline</div>
          <ul id="outline" class="max-h-[40%] overflow-y-auto pb-2 text-[12.5px]"></ul>
        </aside>
      </div>
      <footer class="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-panel px-3 font-mono text-[11.5px] text-muted">
        <span id="status-runtime" class="flex items-center gap-1.5"><span id="dot" class="size-2 rounded-full bg-faint"></span><span id="runtime-text">loading</span></span>
        <span id="status-diags"></span>
        <span class="ml-auto" id="status-cursor"></span>
        <button id="palette-btn" class="hover:text-ink" title="Command palette">Commands <kbd id="palette-keys" class="text-faint"></kbd></button>
        <span>HCL</span>
        <span title="Files and state are stored in this browser">● saved locally</span>
      </footer>
    </div>`;
  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  return {
    version: $("version"),
    themeBtn: $<HTMLButtonElement>("theme-btn"),
    example: $<HTMLSelectElement>("example"),
    commands: [...root.querySelectorAll<HTMLButtonElement>("[data-cmd]")],
    editorPane: $("editor-pane"),
    tabs: $("tabs"),
    editor: $("editor"),
    split: $("split"),
    terminal: $("terminal"),
    termStatus: $("term-status"),
    termClear: $("term-clear"),
    termSection: $("term-section"),
    sidebar: $("sidebar"),
    paletteBtn: $<HTMLButtonElement>("palette-btn"),
    paletteKeys: $("palette-keys"),
    files: $("files"),
    newFile: $("new-file"),
    outline: $("outline"),
    dot: $("dot"),
    runtimeText: $("runtime-text"),
    diags: $("status-diags"),
    cursor: $("status-cursor"),
  };
}

export type Layout = ReturnType<typeof mountLayout>;

/** Drag (or arrow-key) resizing of the editor/terminal split. */
export function wireSplitter(split: HTMLElement, pane: HTMLElement) {
  const setPct = (pct: number) => (pane.style.flex = `0 0 ${Math.min(85, Math.max(15, pct))}%`);
  split.addEventListener("pointerdown", (e) => {
    const parent = pane.parentElement!.getBoundingClientRect();
    split.setPointerCapture(e.pointerId);
    split.classList.add("dragging");
    const move = (ev: PointerEvent) => setPct(((ev.clientY - parent.top) / parent.height) * 100);
    const up = () => (split.classList.remove("dragging"), split.removeEventListener("pointermove", move));
    split.addEventListener("pointermove", move);
    split.addEventListener("pointerup", up, { once: true });
  });
  split.addEventListener("keydown", (e) => {
    const cur = parseFloat(pane.style.flex.split(" ")[2]) || 58;
    if (e.key === "ArrowUp") setPct(cur - 5);
    if (e.key === "ArrowDown") setPct(cur + 5);
  });
}
