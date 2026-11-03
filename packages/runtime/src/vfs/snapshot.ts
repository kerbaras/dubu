// Flat, structured-clone friendly copies of a subtree, used for persistence
// (IndexedDB) and for shipping files between the worker and the UI.
import { Tree, newDir, newFile, newLink, fileBytes, join, normalize, type Node } from "./tree";

export type Entry =
  | { path: string; kind: "dir"; mode: number; mtimeMs: number }
  | { path: string; kind: "file"; mode: number; mtimeMs: number; data: Uint8Array }
  | { path: string; kind: "link"; mode: number; mtimeMs: number; target: string };

export function snapshot(tree: Tree, root: string, skip: (path: string) => boolean = () => false): Entry[] {
  const out: Entry[] = [];
  const visit = (path: string, n: Node) => {
    if (skip(path)) return;
    const base = { path, mode: n.mode & 0o7777, mtimeMs: n.mtimeMs };
    if (n.kind === "file") out.push({ ...base, kind: "file", data: fileBytes(n).slice() });
    else if (n.kind === "link") out.push({ ...base, kind: "link", target: n.target });
    else {
      out.push({ ...base, kind: "dir" });
      for (const [name, c] of n.children) visit(path === "/" ? `/${name}` : `${path}/${name}`, c);
    }
  };
  if (tree.exists(root)) visit(join(normalize(root, "/")), tree.lookup(root, false));
  return out;
}

export function restore(tree: Tree, entries: Entry[]) {
  for (const e of entries) {
    if (e.kind === "dir") {
      tree.mkdirp(e.path);
      continue;
    }
    const { dir, name } = tree.parent(e.path);
    const n = e.kind === "file" ? newFile(e.data, e.mode) : newLink(e.target);
    n.mtimeMs = e.mtimeMs;
    dir.children.set(name, n);
  }
}

/** Removes everything below `root` (keeping `root` itself). */
export function clear(tree: Tree, root: string) {
  const n = tree.exists(root) ? tree.lookup(root) : tree.mkdirp(root);
  if (n.kind === "dir") n.children.clear();
}

export { newDir };
