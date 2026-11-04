// Derives the app chrome (CSS variables) and the xterm palette from a VS Code theme.
import type { ITheme } from "@xterm/xterm";
import { contrast, hex, legible, mix, parse, solid, type Rgba } from "./color";

export type Scheme = "light" | "dark";
export type Palette = { scheme: Scheme; vars: Record<string, string>; terminal: ITheme };
type Colors = Record<string, string | undefined>;

const ANSI = ["Black", "Red", "Green", "Yellow", "Blue", "Magenta", "Cyan", "White"];
// VS Code's own terminal defaults, used when a theme leaves the ANSI colours out.
const DEFAULT_ANSI: Record<Scheme, string[]> = {
  dark: ["#000000", "#cd3131", "#0dbc79", "#e5e510", "#2472c8", "#bc3fbc", "#11a8cd", "#e5e5e5",
    "#666666", "#f14c4c", "#23d18b", "#f5f543", "#3b8eea", "#d670d6", "#29b8db", "#e5e5e5"],
  light: ["#000000", "#cd3131", "#107c10", "#949800", "#0451a5", "#bc05bc", "#0598bc", "#555555",
    "#666666", "#cd3131", "#14ce14", "#b5ba00", "#0451a5", "#bc05bc", "#0598bc", "#a5a5a5"],
};

export function schemeOf(type: string | undefined, colors: Colors): Scheme {
  if (type === "light" || type === "hcLight") return "light";
  if (type === "dark" || type === "hc") return "dark";
  const bg = parse(colors["editor.background"]);
  return bg && contrast(bg, [0, 0, 0, 1]) > contrast(bg, [255, 255, 255, 1]) ? "light" : "dark";
}

export function palette(theme: { type?: string; colors?: Colors }): Palette {
  const c: Colors = theme.colors ?? {};
  const scheme = schemeOf(theme.type, c);
  const black: Rgba = [0, 0, 0, 1];
  const white: Rgba = [255, 255, 255, 1];
  const bg = solid(parse(c["editor.background"]) ?? (scheme === "light" ? white : [30, 30, 30, 1]), scheme === "light" ? white : black);
  const ink = legible(solid(parse(c["editor.foreground"] ?? c.foreground) ?? (scheme === "light" ? [51, 51, 51, 1] : [212, 212, 212, 1]), bg), bg, scheme === "light" ? black : white, 7);
  const fill = (keys: string[], under: Rgba, fallback: number, min = 1.04) => {
    const raw = keys.map((k) => parse(c[k])).find(Boolean);
    const col = raw && solid(raw, under);
    return col && contrast(col, bg) >= min && contrast(col, ink) > 3 ? col : mix(ink, bg, fallback);
  };
  const panel = fill(["sideBar.background", "editorGroupHeader.tabsBackground", "panel.background"], bg, 0.035, 1);
  const raised = fill(["list.hoverBackground", "editorWidget.background"], panel, 0.08);
  const line = fill(["panel.border", "editorGroup.border", "sideBar.border", "contrastBorder"], bg, 0.14, 1.15);
  const ansi = (i: number) => parse(c[`terminal.ansi${i >= 8 ? "Bright" : ""}${ANSI[i % 8]}`]) ?? parse(DEFAULT_ANSI[scheme][i])!;
  const accent = solid(parse(c["button.background"] ?? c.focusBorder ?? c["editorCursor.foreground"]) ?? ansi(4), bg);
  const accentInk = parse(c["button.foreground"]) ?? (contrast(accent, black) > contrast(accent, white) ? black : white);
  const text = (col: Rgba | undefined, fallback: Rgba) => hex(legible(solid(col ?? fallback, bg), panel, ink, 4.5));
  const vars = {
    "--color-bg": hex(bg),
    "--color-panel": hex(panel),
    "--color-raised": hex(raised),
    "--color-line": hex(line),
    "--color-ink": hex(ink),
    "--color-muted": hex(legible(mix(ink, bg, 0.66), panel, ink, 4.5)),
    "--color-faint": hex(legible(mix(ink, bg, 0.45), panel, ink, 3)),
    "--color-tofu": hex(accent),
    "--color-tofu-ink": hex(legible(solid(accentInk, accent), accent, contrast(accent, black) > contrast(accent, white) ? black : white, 4.5)),
    "--color-ok": text(parse(c["terminal.ansiGreen"]), ansi(2)),
    "--color-bad": text(parse(c.errorForeground ?? c["editorError.foreground"]), ansi(1)),
    "--color-info": text(parse(c["textLink.foreground"]), ansi(4)),
  };
  const term = (k: string, fallback: Rgba) => hex(solid(parse(c[k]) ?? fallback, bg));
  const terminal: ITheme = {
    background: hex(bg),
    foreground: term("terminal.foreground", ink),
    cursor: term("terminalCursor.foreground", accent),
    cursorAccent: hex(bg),
    selectionBackground: c["terminal.selectionBackground"] ?? c["editor.selectionBackground"] ?? `${hex(accent)}40`,
    ...Object.fromEntries(ANSI.flatMap((n, i) => [[n.toLowerCase(), hex(ansi(i))], [`bright${n}`, hex(ansi(i + 8))]])),
  };
  return { scheme, vars, terminal };
}
