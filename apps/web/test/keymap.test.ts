import { describe, expect, it, vi } from "vitest";
import { Keymap, keyOf, label } from "../src/ui/keymap";
import { fuzzy } from "../src/ui/fuzzy";

const ev = (code: string, mods: Partial<Record<"metaKey" | "ctrlKey" | "altKey" | "shiftKey", boolean>> = {}, key = code) => ({ key, code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...mods });

describe("keyOf / label", () => {
  it("maps Cmd on macOS and Ctrl elsewhere to mod", () => {
    expect(keyOf(ev("KeyP", { metaKey: true, shiftKey: true }), true)).toBe("mod+shift+p");
    expect(keyOf(ev("KeyP", { ctrlKey: true, shiftKey: true }), false)).toBe("mod+shift+p");
    expect(keyOf(ev("Backquote", { ctrlKey: true }), true)).toBe("ctrl+`");
    expect(keyOf(ev("KeyN", { altKey: true }, "˜"), true)).toBe("alt+n");
    expect(keyOf(ev("Enter", { ctrlKey: true }), false)).toBe("mod+enter");
  });
  it("renders platform labels", () => {
    expect(label("mod+shift+p", true)).toBe("⌘⇧P");
    expect(label("mod+k mod+t", false)).toBe("Ctrl+K Ctrl+T");
    expect(label("f1", false)).toBe("F1");
  });
});

describe("Keymap", () => {
  const setup = () => {
    const clear = vi.fn();
    const theme = vi.fn();
    const sidebar = vi.fn();
    const map = new Keymap<{ terminal: boolean }>([
      { keys: ["mod+k"], run: clear },
      { keys: ["mod+k mod+t"], run: theme },
      { keys: ["mod+l"], run: sidebar, when: (c) => !c.terminal },
    ]);
    return { map, clear, theme, sidebar, ctx: { terminal: false } };
  };

  it("completes chords and falls back to the prefix binding", () => {
    const { map, clear, theme, ctx } = setup();
    expect(map.feed("mod+k", ctx)).toMatchObject({ run: [], pending: true, handled: true });
    map.feed("mod+t", ctx).run.forEach((b) => b.run());
    expect(theme).toHaveBeenCalledOnce();
    map.feed("mod+k", ctx);
    const step = map.feed("x", ctx);
    expect(step.handled).toBe(false);
    step.run.forEach((b) => b.run());
    map.feed("mod+k", ctx);
    map.flush(ctx).forEach((b) => b.run());
    expect(clear).toHaveBeenCalledTimes(2);
  });

  it("ignores lone modifiers mid-chord and respects when", () => {
    const { map, sidebar, ctx } = setup();
    map.feed("mod+k", ctx);
    expect(map.feed("mod+meta", ctx).pending).toBe(true);
    expect(map.feed("mod+l", { terminal: true }).handled).toBe(false);
    map.feed("mod+l", ctx).run.forEach((b) => b.run());
    expect(sidebar).toHaveBeenCalledOnce();
  });
});

describe("fuzzy", () => {
  it("matches subsequences and prefers word starts", () => {
    expect(fuzzy("tgt", "View: Toggle Terminal")).toBeDefined();
    expect(fuzzy("xyz", "View: Toggle Terminal")).toBeUndefined();
    expect(fuzzy("plan", "Tofu: plan")!).toBeGreaterThan(fuzzy("plan", "Preferences: Use Light Theme") ?? -Infinity);
  });
});

describe("chord fallbacks", () => {
  it("accepts a plain second key when the browser keeps Ctrl+T", () => {
    const theme = vi.fn();
    const map = new Keymap<object>([{ keys: ["mod+k"], run: () => {} }, { keys: ["mod+k mod+t", "mod+k t"], run: theme }]);
    map.feed("mod+k", {});
    map.feed("t", {}).run.forEach((b) => b.run());
    expect(theme).toHaveBeenCalledOnce();
  });
});
