// Command-palette style overlay: filter, arrow through, Enter to accept, Escape to cancel.
import { fuzzy } from "./fuzzy";

export interface PickItem {
  label: string;
  detail?: string;
  hint?: string;
  data?: string;
  run(): void;
}

export interface PickOptions {
  placeholder: string;
  prefix?: string;
  active?: number;
  onFocus?(item: PickItem): void;
  onCancel?(): void;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
let close: (() => void) | undefined;

export function quickPick(items: PickItem[], opts: PickOptions) {
  close?.();
  const restore = document.activeElement as HTMLElement | null;
  const root = document.createElement("div");
  root.className = "fixed inset-0 z-[80] flex justify-center bg-black/20 pt-[12vh]";
  root.innerHTML = `<div role="dialog" aria-label="${esc(opts.placeholder)}" class="h-fit w-[min(36rem,92vw)] overflow-hidden rounded-lg border border-line bg-panel shadow-2xl">
    <input role="combobox" spellcheck="false" autocomplete="off" aria-expanded="true" aria-controls="qp-list" class="h-10 w-full border-b border-line bg-transparent px-3 text-[13.5px] text-ink outline-none placeholder:text-faint" placeholder="${esc(opts.placeholder)}" />
    <ul id="qp-list" role="listbox" class="max-h-[50vh] overflow-y-auto py-1 text-[13px]"></ul></div>`;
  document.body.append(root);
  const input = root.querySelector("input")!;
  const list = root.querySelector("ul")!;
  input.value = opts.prefix ?? "";
  let shown: PickItem[] = [];
  let sel = 0;

  const paint = () => {
    list.innerHTML = shown.length
      ? shown
          .map((it, i) => `<li role="option" id="qp-${i}" data-i="${i}" aria-selected="${i === sel}" class="flex cursor-pointer items-center gap-3 px-3 py-1.5 ${i === sel ? "bg-raised text-ink" : "text-muted"}">
            <span class="truncate text-ink">${esc(it.label)}</span>${it.detail ? `<span class="truncate text-[12px] text-faint">${esc(it.detail)}</span>` : ""}
            ${it.hint ? `<kbd class="ml-auto shrink-0 font-mono text-[11.5px] text-faint">${esc(it.hint)}</kbd>` : ""}</li>`)
          .join("")
      : `<li class="px-3 py-2 text-faint">No matches</li>`;
    input.setAttribute("aria-activedescendant", shown.length ? `qp-${sel}` : "");
    list.querySelector(`#qp-${sel}`)?.scrollIntoView({ block: "nearest" });
  };
  const move = (i: number) => {
    if (!shown.length) return;
    sel = (i + shown.length) % shown.length;
    paint();
    opts.onFocus?.(shown[sel]);
  };
  const filter = () => {
    const q = input.value.trim();
    shown = q
      ? items
          .map((it) => ({ it, s: fuzzy(q, `${it.label} ${it.detail ?? ""}`) }))
          .filter((x) => x.s !== undefined)
          .sort((a, b) => b.s! - a.s!)
          .map((x) => x.it)
      : items;
    sel = 0;
    paint();
  };
  const done = (accept?: PickItem) => {
    close = undefined;
    root.remove();
    restore?.focus?.();
    if (accept) accept.run();
    else opts.onCancel?.();
  };
  close = () => done();

  input.addEventListener("input", () => (filter(), shown[sel] && opts.onFocus?.(shown[sel])));
  input.addEventListener("keydown", (e) => {
    const step = { ArrowDown: 1, ArrowUp: -1, PageDown: 10, PageUp: -10 }[e.key];
    if (step) return void (e.preventDefault(), move(Math.abs(step) === 1 ? sel + step : Math.max(0, Math.min(shown.length - 1, sel + step))));
    if (e.key === "Enter") return void (e.preventDefault(), shown[sel] && done(shown[sel]));
    if (e.key === "Escape") return void (e.preventDefault(), done());
  });
  list.addEventListener("pointerdown", (e) => {
    const i = (e.target as HTMLElement).closest<HTMLElement>("[data-i]")?.dataset.i;
    if (i !== undefined) (e.preventDefault(), done(shown[Number(i)]));
  });
  root.addEventListener("pointerdown", (e) => e.target === root && done());
  filter();
  if (opts.active !== undefined && !input.value) {
    sel = Math.max(0, Math.min(items.length - 1, opts.active));
    paint();
  }
  input.focus();
}
