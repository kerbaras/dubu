import { describe, expect, it } from "vitest";
import { contrast, parse } from "../src/theme/color";
import { palette } from "../src/theme/palette";
import { parseThemeFile, stripJsonc } from "../src/theme/theme-file";
import { dubuTheme } from "../src/theme/dubu";

const ratio = (a: string, b: string) => contrast(parse(a)!, parse(b)!);

describe("theme files", () => {
  it("strips comments and trailing commas but not string contents", () => {
    const src = `{\n  // c\n  "name": "a // b, }", /* x */\n  "colors": { "editor.background": "#fff", },\n}`;
    expect(JSON.parse(stripJsonc(src))).toEqual({ name: "a // b, }", colors: { "editor.background": "#fff" } });
  });

  it("parses a VS Code theme and infers the scheme from the background", () => {
    const t = parseThemeFile(`{"name":"My Light","colors":{"editor.background":"#fafafa"},"tokenColors":[]}`, "x.json");
    expect(t).toMatchObject({ name: "custom-my-light", displayName: "My Light", type: "light" });
  });

  it("rejects files that aren't themes or point at other files", () => {
    expect(() => parseThemeFile("[1]", "a.json")).toThrow(/isn't a VS Code colour theme/);
    expect(() => parseThemeFile(`{"tokenColors":"./t.tmTheme"}`, "a.json")).toThrow(/points at another file/);
    expect(() => parseThemeFile("{nope", "a.json")).toThrow(/isn't valid JSON/);
  });
});

describe("palette", () => {
  it("keeps the dubu chrome colours", () => {
    const p = palette(dubuTheme);
    expect(p.scheme).toBe("dark");
    expect(p.vars).toMatchObject({ "--color-bg": "#131210", "--color-panel": "#191815", "--color-tofu": "#ffda18", "--color-tofu-ink": "#1a1700" });
    expect(p.terminal.yellow).toBe("#ffda18");
  });

  it("keeps small text legible on themes with weak or missing colours", () => {
    const p = palette({ type: "light", colors: { "editor.background": "#ffffff", "button.background": "#ffee00", errorForeground: "#ffaaaa" } });
    const v = p.vars;
    for (const k of ["--color-ink", "--color-muted", "--color-bad", "--color-ok", "--color-info"]) expect(ratio(v[k], v["--color-panel"])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(v["--color-tofu-ink"], v["--color-tofu"])).toBeGreaterThanOrEqual(4.5);
    expect(p.terminal.red).toBe("#cd3131");
  });
});
