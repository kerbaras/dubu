// Theme list (dubu, shiki's bundled VS Code themes, user imports) and preferences.
import type { ThemeRegistration } from "shiki/core";
import { bundledThemes, bundledThemesInfo } from "shiki/themes";
import { idbGet, idbSet } from "@dubu/runtime";
import { dubuTheme } from "./dubu";
import type { CustomTheme } from "./theme-file";
import type { Scheme } from "./palette";

export type Mode = "system" | Scheme;
export type ThemeInfo = { id: string; label: string; scheme: Scheme; custom?: boolean };
export type Prefs = { mode: Mode; dark: string; light: string };

const KEY = "themes:v1";
const DEFAULTS: Prefs = { mode: "system", dark: "dubu", light: "github-light" };

let custom: CustomTheme[] = [];

export async function loadCustom() {
  custom = (await idbGet<CustomTheme[]>(KEY).catch(() => undefined)) ?? [];
}

export async function addCustom(theme: CustomTheme) {
  custom = [...custom.filter((t) => t.name !== theme.name), theme];
  await idbSet(KEY, custom);
}

export async function removeCustom(id: string) {
  custom = custom.filter((t) => t.name !== id);
  await idbSet(KEY, custom);
}

export function catalog(): ThemeInfo[] {
  return [
    { id: "dubu", label: "dubu", scheme: "dark" as Scheme },
    ...bundledThemesInfo.map((t) => ({ id: t.id, label: t.displayName, scheme: t.type as Scheme })),
    ...custom.map((t) => ({ id: t.name, label: t.displayName, scheme: t.type, custom: true })),
  ];
}

export async function loadTheme(id: string): Promise<ThemeRegistration> {
  const own = id === "dubu" ? dubuTheme : custom.find((t) => t.name === id);
  if (own) return own;
  const load = bundledThemes[id as keyof typeof bundledThemes];
  if (!load) return dubuTheme;
  return (await load()).default as ThemeRegistration;
}

export function prefs(): Prefs {
  const known = new Set(catalog().map((t) => t.id));
  const get = <K extends keyof Prefs>(k: K) => (localStorage.getItem(`theme.${k}`) as Prefs[K] | null) ?? DEFAULTS[k];
  const mode = (["system", "light", "dark"] as const).includes(get("mode")) ? get("mode") : DEFAULTS.mode;
  const valid = (k: "dark" | "light") => (known.has(get(k)) ? get(k) : DEFAULTS[k]);
  return { mode, dark: valid("dark"), light: valid("light") };
}

export function savePrefs(p: Partial<Prefs>) {
  for (const [k, v] of Object.entries(p)) localStorage.setItem(`theme.${k}`, v);
}

export const systemScheme = (): Scheme => (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
export const activeId = (p: Prefs) => p[p.mode === "system" ? systemScheme() : p.mode];
