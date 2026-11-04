// Parses a dropped VS Code colour theme (JSON with comments) into a shiki theme.
import type { ThemeRegistration } from "shiki/core";
import { schemeOf } from "./palette";

export type CustomTheme = ThemeRegistration & { name: string; displayName: string; type: "light" | "dark" };

/** Removes `//` and block comments plus trailing commas, leaving string contents intact. */
export function stripJsonc(text: string) {
  return text
    .replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (_, str) => str ?? "")
    .replace(/("(?:\\.|[^"\\])*")|,(\s*[}\]])/g, (_, str, close) => str ?? close);
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "theme";

export function parseThemeFile(text: string, fileName: string): CustomTheme {
  let raw: unknown;
  try {
    raw = JSON.parse(stripJsonc(text.replace(/^\uFEFF/, "")));
  } catch {
    throw new Error(`${fileName} isn't valid JSON. Drop a VS Code colour theme (.json).`);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${fileName} isn't a VS Code colour theme.`);
  const t = raw as Record<string, unknown>;
  const tokenColors = t.tokenColors ?? t.settings;
  if (typeof tokenColors === "string" || typeof t.include === "string")
    throw new Error(`${fileName} points at another file (${String(t.include ?? tokenColors)}). Use a theme with its colours inline.`);
  const colors = isRecord(t.colors) ? (t.colors as Record<string, string>) : {};
  if (!Array.isArray(tokenColors) && !Object.keys(colors).length) throw new Error(`${fileName} has no "colors" or "tokenColors", so it isn't a VS Code colour theme.`);
  const displayName = typeof t.name === "string" && t.name.trim() ? t.name.trim() : fileName.replace(/\.[^.]+$/, "");
  return {
    name: `custom-${slug(displayName)}`,
    displayName,
    type: schemeOf(typeof t.type === "string" ? t.type : undefined, colors),
    colors,
    tokenColors: Array.isArray(tokenColors) ? tokenColors : [],
  };
}

const isRecord = (v: unknown) => !!v && typeof v === "object" && !Array.isArray(v);
