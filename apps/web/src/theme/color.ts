// Tiny colour helpers for deriving the app palette from a VS Code theme.
export type Rgba = [number, number, number, number];

export function parse(hex: string | undefined): Rgba | undefined {
  const m = hex?.trim().match(/^#?([0-9a-f]{3,8})$/i);
  if (!m || ![3, 4, 6, 8].includes(m[1].length)) return undefined;
  const h = m[1].length <= 4 ? [...m[1]].map((c) => c + c).join("") : m[1];
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
}

export const hex = ([r, g, b]: Rgba) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** `a` at weight `t` over `b`. */
export function mix(a: Rgba, b: Rgba, t: number): Rgba {
  return [0, 1, 2].map((i) => a[i] * t + b[i] * (1 - t)).concat(1) as Rgba;
}

/** Composites a translucent colour over `under` so it can be used as a solid fill. */
export const solid = (c: Rgba, under: Rgba): Rgba => mix(c, under, c[3]);

export function luminance([r, g, b]: Rgba) {
  const ch = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrast(a: Rgba, b: Rgba) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Moves `fg` toward `toward` until it reaches `min` contrast against `bg`. */
export function legible(fg: Rgba, bg: Rgba, toward: Rgba, min: number): Rgba {
  let c = fg;
  for (let t = 0.1; contrast(c, bg) < min && t <= 1; t += 0.1) c = mix(toward, fg, t);
  return c;
}
