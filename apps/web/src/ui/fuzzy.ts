// Subsequence matching for the quick pick: contiguous runs and word starts score higher.
export function fuzzy(query: string, text: string): number | undefined {
  const q = query.toLowerCase().replace(/\s+/g, "");
  const t = text.toLowerCase();
  let score = 0;
  let at = -1;
  for (const ch of q) {
    const i = t.indexOf(ch, at + 1);
    if (i < 0) return undefined;
    score += i === at + 1 ? 3 : 0;
    score += i === 0 || /[\s:./_-]/.test(t[i - 1]) ? 2 : 0;
    score -= Math.min(i - at - 1, 5) * 0.1;
    at = i;
  }
  return score;
}
