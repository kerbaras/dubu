// Theme popover (System/Light/Dark + a theme per scheme), file import and drag-and-drop.
import type { Terminal } from "@xterm/xterm";
import { activeId, addCustom, catalog, prefs, removeCustom, savePrefs, systemScheme, type Mode, type Prefs, type ThemeInfo } from "../theme/catalog";
import { applyTheme } from "../theme/engine";
import { parseThemeFile } from "../theme/theme-file";
import type { Scheme } from "../theme/palette";
import { toast } from "./toast";

const html = String.raw;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function options(list: ThemeInfo[], selected: string) {
  const opt = (t: ThemeInfo) => `<option value="${esc(t.id)}"${t.id === selected ? " selected" : ""}>${esc(t.label)}</option>`;
  const own = list.filter((t) => t.custom);
  return list.filter((t) => !t.custom).map(opt).join("") + (own.length ? `<optgroup label="Imported">${own.map(opt).join("")}</optgroup>` : "");
}

export function wireThemes(button: HTMLButtonElement, term: Terminal) {
  const panel = document.createElement("div");
  panel.id = "theme-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Theme");
  panel.className = "absolute right-0 top-10 z-50 hidden w-72 rounded-lg border border-line bg-panel p-3 text-[12.5px] shadow-2xl";
  button.parentElement!.classList.add("relative");
  button.after(panel);
  const file = Object.assign(document.createElement("input"), { type: "file", accept: ".json,.jsonc,application/json", multiple: true, hidden: true });
  panel.after(file);

  let applied = "";
  let chain = Promise.resolve();
  const show = (id: string) =>
    (chain = chain.then(() => applyTheme(id, term).then(() => {}, (e) => toast(`Couldn't load theme: ${e instanceof Error ? e.message : e}`, true))));
  const refresh = async () => {
    const id = activeId(prefs());
    if (id === applied) return;
    applied = id;
    await show(id);
  };

  const render = () => {
    const p = prefs();
    const list = catalog();
    const select = (s: Scheme) => html`
      <label class="mt-3 block">
        <span class="mb-1 flex items-center justify-between text-muted">${s === "dark" ? "Dark theme" : "Light theme"}${p.mode === "system" && systemScheme() === s ? `<span class="text-[11px] text-faint">active now</span>` : ""}</span>
        <select data-scheme="${s}" class="h-8 w-full rounded-md border border-line bg-bg px-2 text-[13px] text-ink">${options(list.filter((t) => t.scheme === s), p[s])}</select>
      </label>`;
    const custom = list.filter((t) => t.custom);
    panel.innerHTML = html`
      <div role="radiogroup" aria-label="Appearance" class="grid grid-cols-3 gap-1 rounded-md border border-line bg-bg p-0.5">
        ${(["system", "light", "dark"] as Mode[]).map((m) => `<button role="radio" aria-checked="${p.mode === m}" data-mode="${m}" class="h-7 rounded capitalize ${p.mode === m ? "bg-raised text-ink" : "text-muted hover:text-ink"}">${m}</button>`).join("")}
      </div>
      ${select("dark")}${select("light")}
      <button data-import class="btn mt-3 w-full justify-center">Import VS Code theme…</button>
      <p class="mt-2 text-[11.5px] text-faint">Or drop a theme <span class="font-mono">.json</span> anywhere on the page.</p>
      ${custom.length ? `<ul class="mt-2 border-t border-line pt-2">${custom.map((t) => `<li class="flex items-center justify-between py-0.5"><span class="truncate">${esc(t.label)} <span class="text-faint">· ${t.scheme}</span></span><button class="icon-btn size-6" data-remove="${esc(t.id)}" aria-label="Remove ${esc(t.label)}">✕</button></li>`).join("")}</ul>` : ""}`;
  };

  const update = async (p: Partial<Prefs>) => {
    savePrefs(p);
    render();
    await refresh();
  };

  const open = (show: boolean) => {
    panel.classList.toggle("hidden", !show);
    button.setAttribute("aria-expanded", String(show));
    if (show) (render(), panel.querySelector<HTMLElement>("[aria-checked=true]")?.focus());
  };
  button.setAttribute("aria-haspopup", "dialog");
  button.addEventListener("click", () => open(panel.classList.contains("hidden")));
  document.addEventListener("pointerdown", (e) => !panel.contains(e.target as Node) && !button.contains(e.target as Node) && open(false));
  panel.addEventListener("keydown", (e) => e.key === "Escape" && (open(false), button.focus()));

  panel.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const mode = t.closest<HTMLElement>("[data-mode]")?.dataset.mode as Mode | undefined;
    if (mode) return void update({ mode }).then(() => panel.querySelector<HTMLElement>(`[data-mode=${mode}]`)?.focus());
    if (t.closest("[data-import]")) return file.click();
    const remove = t.closest<HTMLElement>("[data-remove]")?.dataset.remove;
    if (remove) void removeCustom(remove).then(() => ((applied = ""), update({})));
  });
  panel.addEventListener("change", (e) => {
    const sel = e.target as HTMLSelectElement;
    const scheme = sel.dataset.scheme as Scheme | undefined;
    if (!scheme) return;
    const p = prefs();
    void update({ [scheme]: sel.value, ...(p.mode !== "system" && p.mode !== scheme ? { mode: scheme } : {}) });
  });
  file.addEventListener("change", () => void importFiles([...(file.files ?? [])]).then(() => (file.value = "")));
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => (render(), void refresh()));

  async function importFiles(files: File[]) {
    for (const f of files) {
      try {
        const theme = parseThemeFile(await f.text(), f.name);
        await addCustom(theme);
        applied = "";
        const p = prefs();
        await update({ [theme.type]: theme.name, ...(p.mode === "system" && systemScheme() === theme.type ? {} : { mode: theme.type }) });
        toast(`Added theme “${theme.displayName}”`);
      } catch (e) {
        toast(e instanceof Error ? e.message : String(e), true);
      }
    }
  }

  wireDrop(importFiles);
  const choose = (id: string) => {
    const scheme = catalog().find((t) => t.id === id)?.scheme;
    if (!scheme) return;
    applied = "";
    void update({ [scheme]: id, ...(prefs().mode === "system" && systemScheme() === scheme ? {} : { mode: scheme }) });
  };
  return {
    refresh,
    open: () => open(true),
    choose,
    preview: (id: string) => ((applied = ""), void show(id)),
    revert: () => ((applied = ""), void refresh()),
    setMode: (mode: Mode) => void update({ mode }),
    importFile: () => file.click(),
  };
}

/** Window-wide drop target for theme files (captured before Monaco can paste them as text). */
function wireDrop(onFiles: (files: File[]) => void) {
  const overlay = document.createElement("div");
  overlay.className = "pointer-events-none fixed inset-0 z-[60] hidden items-center justify-center bg-bg/80 backdrop-blur-sm";
  overlay.innerHTML = `<div class="rounded-xl border-2 border-dashed border-tofu px-8 py-6 text-[15px] text-ink">Drop a VS Code theme <span class="font-mono">.json</span> to add it</div>`;
  document.body.append(overlay);
  let depth = 0;
  const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");
  const show = (on: boolean) => (overlay.classList.toggle("hidden", !on), overlay.classList.toggle("flex", on));
  const opts = { capture: true };
  window.addEventListener("dragenter", (e) => hasFiles(e) && (depth++, show(true)), opts);
  window.addEventListener("dragleave", (e) => hasFiles(e) && --depth <= 0 && ((depth = 0), show(false)), opts);
  window.addEventListener("dragover", (e) => hasFiles(e) && (e.preventDefault(), e.stopPropagation()), opts);
  window.addEventListener("drop", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    depth = 0;
    show(false);
    onFiles([...(e.dataTransfer?.files ?? [])]);
  }, opts);
}
