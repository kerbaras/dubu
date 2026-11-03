// Node-style callback fs API that Go's syscall/fs_js.go expects on globalThis.fs.
import { FsError, Tree, newDir, newFile, newLink, fileBytes, S_IFMT, type Node } from "./tree";
import { FdTable, type Stdio } from "./fds";

type Cb<T = unknown> = (err: unknown, res?: T) => void;

const constants = {
  O_RDONLY: 0, O_WRONLY: 1, O_RDWR: 2, O_CREAT: 64, O_EXCL: 128,
  O_TRUNC: 512, O_APPEND: 1024, O_DIRECTORY: 65536,
};

function stat(n: Node) {
  const size = n.kind === "file" ? n.size : n.kind === "link" ? n.target.length : 4096;
  return {
    dev: 1, ino: n.ino, mode: n.mode, nlink: 1, uid: 1000, gid: 1000, rdev: 0,
    size, blksize: 4096, blocks: Math.ceil(size / 512),
    atimeMs: n.atimeMs, mtimeMs: n.mtimeMs, ctimeMs: n.ctimeMs,
    isDirectory: () => n.kind === "dir",
  };
}

const wrap = <T>(cb: Cb<T>, fn: () => T) => {
  let res: T;
  try {
    res = fn();
  } catch (e) {
    cb(e instanceof FsError ? e : new FsError("EIO", String(e)));
    return;
  }
  cb(null, res);
};

export function createFsApi(tree: Tree, stdio: Stdio, onChange: (path: string) => void) {
  const fds = new FdTable(tree, stdio);
  const touch = (path: string) => onChange(path);
  return {
    constants,
    writeSync(fd: number, buf: Uint8Array) {
      fds.writeStdio(fd, buf);
      return buf.length;
    },
    open(path: string, flags: number, mode: number, cb: Cb<number>) {
      wrap(cb, () => {
        let node: Node | undefined;
        try {
          node = tree.lookup(path);
        } catch (e) {
          if (!(e instanceof FsError && e.code === "ENOENT") || !(flags & constants.O_CREAT)) throw e;
        }
        if (node && flags & constants.O_CREAT && flags & constants.O_EXCL) throw new FsError("EEXIST");
        if (!node) {
          const { dir, name } = tree.parent(path);
          dir.children.set(name, (node = newFile(undefined, mode & 0o777)));
          touch(path);
        }
        if (node.kind === "dir" && flags & 3) throw new FsError("EISDIR");
        if (node.kind === "file" && flags & constants.O_TRUNC) {
          node.size = 0;
          node.mtimeMs = Date.now();
          touch(path);
        }
        return fds.open(node, path, flags);
      });
    },
    close: (fd: number, cb: Cb) => wrap(cb, () => fds.close(fd)),
    read(fd: number, buf: Uint8Array, off: number, len: number, pos: number | null, cb: Cb<number>) {
      if (fd === 0) {
        stdio.read(len).then((b) => (buf.set(b, off), cb(null, b.length)), cb);
        return;
      }
      wrap(cb, () => fds.read(fd, buf.subarray(off, off + len), pos));
    },
    write(fd: number, buf: Uint8Array, off: number, len: number, pos: number | null, cb: Cb<number>) {
      wrap(cb, () => {
        const n = fds.write(fd, buf.subarray(off, off + len), pos);
        const path = fds.pathOf(fd);
        if (path) touch(path);
        return n;
      });
    },
    fstat: (fd: number, cb: Cb) => wrap(cb, () => stat(fds.get(fd).node)),
    stat: (p: string, cb: Cb) => wrap(cb, () => stat(tree.lookup(p))),
    lstat: (p: string, cb: Cb) => wrap(cb, () => stat(tree.lookup(p, false))),
    readdir: (p: string, cb: Cb<string[]>) =>
      wrap(cb, () => {
        const n = tree.lookup(p);
        if (n.kind !== "dir") throw new FsError("ENOTDIR");
        return [...n.children.keys()];
      }),
    mkdir: (p: string, perm: number, cb: Cb) =>
      wrap(cb, () => {
        const { dir, name } = tree.parent(p);
        if (dir.children.has(name)) throw new FsError("EEXIST");
        dir.children.set(name, newDir(perm & 0o777));
      }),
    rmdir: (p: string, cb: Cb) =>
      wrap(cb, () => {
        const { dir, name } = tree.parent(p);
        const n = dir.children.get(name);
        if (!n) throw new FsError("ENOENT");
        if (n.kind !== "dir") throw new FsError("ENOTDIR");
        if (n.children.size) throw new FsError("ENOTEMPTY");
        dir.children.delete(name);
      }),
    unlink: (p: string, cb: Cb) =>
      wrap(cb, () => {
        const { dir, name } = tree.parent(p);
        const n = dir.children.get(name);
        if (!n) throw new FsError("ENOENT");
        if (n.kind === "dir") throw new FsError("EISDIR");
        dir.children.delete(name);
        touch(p);
      }),
    rename: (from: string, to: string, cb: Cb) =>
      wrap(cb, () => {
        const a = tree.parent(from);
        const n = a.dir.children.get(a.name);
        if (!n) throw new FsError("ENOENT");
        const b = tree.parent(to);
        const old = b.dir.children.get(b.name);
        if (old?.kind === "dir" && old.children.size) throw new FsError("ENOTEMPTY");
        a.dir.children.delete(a.name);
        b.dir.children.set(b.name, n);
        touch(from);
        touch(to);
      }),
    symlink: (target: string, p: string, cb: Cb) =>
      wrap(cb, () => {
        const { dir, name } = tree.parent(p);
        if (dir.children.has(name)) throw new FsError("EEXIST");
        dir.children.set(name, newLink(target));
      }),
    readlink: (p: string, cb: Cb<string>) =>
      wrap(cb, () => {
        const n = tree.lookup(p, false);
        if (n.kind !== "link") throw new FsError("EINVAL");
        return n.target;
      }),
    link: (from: string, to: string, cb: Cb) =>
      wrap(cb, () => {
        const n = tree.lookup(from);
        const { dir, name } = tree.parent(to);
        if (dir.children.has(name)) throw new FsError("EEXIST");
        dir.children.set(name, n);
      }),
    chmod: (p: string, mode: number, cb: Cb) =>
      wrap(cb, () => {
        const n = tree.lookup(p);
        n.mode = (n.mode & S_IFMT) | (mode & 0o7777);
      }),
    fchmod: (fd: number, mode: number, cb: Cb) =>
      wrap(cb, () => {
        const n = fds.get(fd).node;
        n.mode = (n.mode & S_IFMT) | (mode & 0o7777);
      }),
    chown: (_p: string, _u: number, _g: number, cb: Cb) => cb(null),
    fchown: (_fd: number, _u: number, _g: number, cb: Cb) => cb(null),
    lchown: (_p: string, _u: number, _g: number, cb: Cb) => cb(null),
    utimes: (p: string, atime: number, mtime: number, cb: Cb) =>
      wrap(cb, () => {
        const n = tree.lookup(p);
        n.atimeMs = atime * 1000;
        n.mtimeMs = mtime * 1000;
      }),
    truncate: (p: string, len: number, cb: Cb) => wrap(cb, () => (fds.truncate(tree.lookup(p), len), touch(p))),
    ftruncate: (fd: number, len: number, cb: Cb) => wrap(cb, () => fds.truncate(fds.get(fd).node, len)),
    fsync: (_fd: number, cb: Cb) => cb(null),
  };
}

export { fileBytes };
