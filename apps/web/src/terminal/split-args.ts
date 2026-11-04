/** Shell-style word splitting: quotes may appear mid-word (`-var="a b"`). */
export function splitArgs(line: string): string[] {
  const out: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'|\\(.)|(\s+)|([^\s"'\\]+)/g;
  let word: string | undefined;
  for (let m; (m = re.exec(line)); ) {
    if (m[4] !== undefined) {
      if (word !== undefined) out.push(word);
      word = undefined;
      continue;
    }
    word = (word ?? "") + (m[1]?.replace(/\\(.)/g, "$1") ?? m[2] ?? m[3] ?? m[5]);
  }
  if (word !== undefined) out.push(word);
  return out;
}
