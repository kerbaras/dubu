// In-memory POSIX-like file tree used as the filesystem of the wasm process.

export const S_IFMT = 0o170000;
export const S_IFDIR = 0o040000;
export const S_IFREG = 0o100000;
export const S_IFLNK = 0o120000;

interface Base {
  ino: number;
  mode: number;
  atimeMs: number;
  mtimeMs: number;
  ctimeMs: number;
}
export interface FileNode extends Base {
  kind: "file";
  data: Uint8Array;
  size: number;
}
export interface DirNode extends Base {
  kind: "dir";
  children: Map<string, Node>;
}
export interface LinkNode extends Base {
  kind: "link";
  target: string;
}
export type Node = FileNode | DirNode | LinkNode;

export class FsError extends Error {
  constructor(
    public code: string,
    msg = code,
  ) {
    super(msg);
  }
}

let nextIno = 1;
const stamp = (mode: number) => {
  const now = Date.now();
  return { ino: nextIno++, mode, atimeMs: now, mtimeMs: now, ctimeMs: now };
};

export const newDir = (perm = 0o755): DirNode => ({
  kind: "dir",
  children: new Map(),
  ...stamp(S_IFDIR | perm),
});
export const newFile = (data = new Uint8Array(0), perm = 0o644): FileNode => ({
  kind: "file",
  data,
  size: data.length,
  ...stamp(S_IFREG | perm),
});
export const newLink = (target: string): LinkNode => ({
  kind: "link",
  target,
  ...stamp(S_IFLNK | 0o777),
});

export const fileBytes = (f: FileNode) => f.data.subarray(0, f.size);

export function normalize(path: string, cwd: string): string[] {
  const parts = (path.startsWith("/") ? path : `${cwd}/${path}`).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return out;
}

export const join = (parts: string[]) => "/" + parts.join("/");

export class Tree {
  root: DirNode = newDir();
  cwd = "/";

  /** Resolves a path, following symlinks (the last one only if `follow`). */
  lookup(path: string, follow = true, depth = 0): Node {
    const r = this.walk(path, follow, depth);
    if (!r.node) throw new FsError("ENOENT", `no such file: ${path}`);
    return r.node;
  }

  /** Returns the parent directory and base name for a path. */
  parent(path: string): { dir: DirNode; name: string } {
    const parts = normalize(path, this.cwd);
    const name = parts.pop();
    if (name === undefined) throw new FsError("EEXIST");
    const dir = this.lookup(join(parts));
    if (dir.kind !== "dir") throw new FsError("ENOTDIR");
    return { dir, name };
  }

  exists(path: string): boolean {
    return this.walk(path, false, 0).node !== undefined;
  }

  mkdirp(path: string): DirNode {
    let dir = this.root;
    for (const p of normalize(path, this.cwd)) {
      let next = dir.children.get(p);
      if (!next) dir.children.set(p, (next = newDir()));
      if (next.kind !== "dir") throw new FsError("ENOTDIR");
      dir = next;
    }
    return dir;
  }

  private walk(path: string, follow: boolean, depth: number): { node?: Node } {
    if (depth > 40) throw new FsError("ELOOP");
    const parts = normalize(path, this.cwd);
    let node: Node = this.root;
    for (let i = 0; i < parts.length; i++) {
      if (node.kind !== "dir") throw new FsError("ENOTDIR");
      const child: Node | undefined = node.children.get(parts[i]);
      if (!child) return {};
      const last = i === parts.length - 1;
      if (child.kind === "link" && (!last || follow)) {
        const base = join(parts.slice(0, i));
        const rest = parts.slice(i + 1).join("/");
        const target = child.target.startsWith("/") ? child.target : `${base}/${child.target}`;
        return this.walk(rest ? `${target}/${rest}` : target, follow, depth + 1);
      }
      node = child;
    }
    return { node };
  }
}
