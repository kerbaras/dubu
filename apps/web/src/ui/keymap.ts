// VS Code-style key chords ("mod+k mod+t"): key normalisation, labels and a pure matcher.
export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

type KeyLike = Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">;

/** "mod" is Cmd on macOS and Ctrl elsewhere; letters come from `code` so Alt/Option combos stay readable. */
export function keyOf(e: KeyLike, mac = isMac): string {
  const key = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : /^Digit\d$/.test(e.code) ? e.code.slice(5) : e.code === "Backquote" ? "`" : e.key.toLowerCase();
  const mods = [mac && e.ctrlKey && "ctrl", (mac ? e.metaKey : e.ctrlKey) && "mod", e.altKey && "alt", e.shiftKey && "shift"];
  return [...mods.filter(Boolean), key].join("+");
}

const names: Record<string, [mac: string, other: string]> = { mod: ["⌘", "Ctrl+"], ctrl: ["⌃", "Ctrl+"], alt: ["⌥", "Alt+"], shift: ["⇧", "Shift+"], enter: ["↩", "Enter"] };

export const label = (keys: string, mac = isMac) =>
  keys
    .split(" ")
    .map((chord) => chord.split("+").map((p) => names[p]?.[mac ? 0 : 1] ?? (p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1))).join(""))
    .join(" ");

export interface Binding<C = unknown> {
  keys: string[];
  run(): void;
  when?(ctx: C): boolean;
}

export type Step<C> = { run: Binding<C>[]; pending: boolean; handled: boolean };

/** Feeds one key at a time. A key that is both a binding and a chord prefix runs if the chord isn't completed. */
export class Keymap<C> {
  private prefix?: string;

  constructor(private bindings: Binding<C>[]) {}

  get pending() {
    return this.prefix !== undefined;
  }

  private find(keys: string, ctx: C) {
    return this.bindings.find((b) => b.keys.includes(keys) && (b.when?.(ctx) ?? true));
  }

  private starts(key: string, ctx: C) {
    return this.bindings.some((b) => b.keys.some((k) => k.startsWith(`${key} `)) && (b.when?.(ctx) ?? true));
  }

  feed(key: string, ctx: C): Step<C> {
    if (/^(.*\+)?(meta|control|alt|shift)$/.test(key)) return { run: [], pending: this.pending, handled: false };
    const run: Binding<C>[] = [];
    if (this.prefix !== undefined) {
      const prefix = this.prefix;
      this.prefix = undefined;
      const chord = this.find(`${prefix} ${key}`, ctx);
      if (chord) return { run: [chord], pending: false, handled: true };
      const fallback = this.find(prefix, ctx);
      if (fallback) run.push(fallback);
    }
    if (this.starts(key, ctx)) {
      this.prefix = key;
      return { run, pending: true, handled: true };
    }
    const hit = this.find(key, ctx);
    return hit ? { run: [...run, hit], pending: false, handled: true } : { run, pending: false, handled: false };
  }

  /** Chord timed out: run the prefix's own binding, if any. */
  flush(ctx: C): Binding<C>[] {
    const prefix = this.prefix;
    this.prefix = undefined;
    const b = prefix === undefined ? undefined : this.find(prefix, ctx);
    return b ? [b] : [];
  }
}

/** Listens before Monaco/xterm see the key (capture phase) and runs matching bindings. */
export function listen<C>(map: Keymap<C>, ctx: () => C, timeout = 900) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.isComposing) return;
      clearTimeout(timer);
      const step = map.feed(keyOf(e), ctx());
      if (step.handled) (e.preventDefault(), e.stopPropagation());
      for (const b of step.run) b.run();
      if (step.pending) timer = setTimeout(() => map.flush(ctx()).forEach((b) => b.run()), timeout);
    },
    { capture: true },
  );
}
