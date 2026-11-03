// File descriptor table: positions, flags and stdio routing.
import { FsError, Tree, type Node, type FileNode } from "./tree";

export interface Stdio {
  /** Bytes written by the process to fd 1 or 2. */
  write(fd: 1 | 2, data: Uint8Array): void;
  /** Resolves with up to `max` bytes of input; an empty array means EOF. */
  read(max: number): Promise<Uint8Array>;
}

interface Open {
  node: Node;
  path: string;
  pos: number;
  flags: number;
}

const O_APPEND = 1024;
const ACCMODE = 3;

function grow(f: FileNode, size: number) {
  if (size <= f.data.length) return;
  const next = new Uint8Array(Math.max(size, f.data.length * 2, 64));
  next.set(f.data.subarray(0, f.size));
  f.data = next;
}

export class FdTable {
  private open_ = new Map<number, Open>();
  private next = 3;

  constructor(
    private tree: Tree,
    private stdio: Stdio,
  ) {}

  open(node: Node, path: string, flags: number): number {
    const fd = this.next++;
    this.open_.set(fd, { node, path, pos: 0, flags });
    return fd;
  }

  get(fd: number): Open {
    if (fd <= 2) return { node: this.tree.lookup("/dev/tty"), path: "/dev/tty", pos: 0, flags: 2 };
    const o = this.open_.get(fd);
    if (!o) throw new FsError("EBADF");
    return o;
  }

  pathOf(fd: number): string | undefined {
    return fd > 2 ? this.open_.get(fd)?.path : undefined;
  }

  close(fd: number) {
    if (fd > 2 && !this.open_.delete(fd)) throw new FsError("EBADF");
  }

  writeStdio(fd: number, buf: Uint8Array) {
    this.stdio.write(fd === 2 ? 2 : 1, buf.slice());
  }

  read(fd: number, buf: Uint8Array, pos: number | null): number {
    const o = this.get(fd);
    if (o.node.kind === "dir") throw new FsError("EISDIR");
    if (o.node.kind !== "file") throw new FsError("EINVAL");
    const at = pos ?? o.pos;
    const n = Math.max(0, Math.min(buf.length, o.node.size - at));
    buf.set(o.node.data.subarray(at, at + n));
    if (pos === null) o.pos += n;
    o.node.atimeMs = Date.now();
    return n;
  }

  write(fd: number, buf: Uint8Array, pos: number | null): number {
    if (fd === 1 || fd === 2) {
      this.writeStdio(fd, buf);
      return buf.length;
    }
    const o = this.get(fd);
    if ((o.flags & ACCMODE) === 0) throw new FsError("EBADF");
    if (o.node.kind !== "file") throw new FsError("EISDIR");
    const f = o.node;
    const at = pos ?? (o.flags & O_APPEND ? f.size : o.pos);
    grow(f, at + buf.length);
    f.data.set(buf, at);
    f.size = Math.max(f.size, at + buf.length);
    f.mtimeMs = Date.now();
    if (pos === null) o.pos = at + buf.length;
    return buf.length;
  }

  truncate(node: Node, len: number) {
    if (node.kind !== "file") throw new FsError("EISDIR");
    grow(node, len);
    if (len > node.size) node.data.fill(0, node.size, len);
    node.size = len;
    node.mtimeMs = Date.now();
  }
}
