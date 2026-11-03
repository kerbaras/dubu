// Workspace file list and outline.
import type { Sym } from "../editor/symbols";
import type { WsFile } from "../workspace/store";

const icon = (p: string) => (/\.(tf|tofu)$/.test(p) ? "◆" : p.endsWith(".tfstate") ? "▤" : "·");

export function renderFiles(list: HTMLElement, files: WsFile[], active: string | undefined) {
  list.replaceChildren(
    ...files.map((f) => {
      const li = document.createElement("li");
      li.innerHTML = `<button class="group flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-raised"><span class="w-3 text-center text-[10px] text-tofu"></span><span class="truncate font-mono text-[12.5px]"></span><span class="ml-auto hidden text-faint group-hover:inline" data-del title="Delete">✕</span></button>`;
      const btn = li.firstElementChild as HTMLButtonElement;
      btn.dataset.path = f.path;
      if (f.path === active) btn.classList.add("bg-raised", "text-ink");
      else btn.classList.add("text-muted");
      btn.children[0].textContent = icon(f.path);
      btn.children[1].textContent = f.path;
      return li;
    }),
  );
}

export function renderOutline(list: HTMLElement, syms: Sym[]) {
  list.replaceChildren(
    ...syms.map((s) => {
      const li = document.createElement("li");
      li.innerHTML = `<button class="flex w-full items-baseline gap-2 px-3 py-0.5 text-left text-muted hover:bg-raised hover:text-ink"><span class="w-12 shrink-0 font-mono text-[10.5px] text-faint"></span><span class="truncate font-mono"></span></button>`;
      const btn = li.firstElementChild as HTMLButtonElement;
      btn.dataset.file = s.file;
      btn.dataset.line = String(s.line);
      btn.children[0].textContent = s.kind;
      btn.children[1].textContent = s.type ? `${s.type}.${s.name}` : s.name;
      return li;
    }),
  );
}
