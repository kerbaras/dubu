// The sandbox "machine": a file tree, a tty and the process object Go expects.
import { Tree, newFile } from "./vfs/tree";
import { createFsApi } from "./vfs/fs-api";
import { Tty, type TtyHooks } from "./tty";
import { WORKSPACE } from "./protocol";

export const HOME = "/home/user";
export const CLI_CONFIG = "/etc/tofurc";
const MIRROR = "/usr/share/tofu/providers";

// Only providers compiled into tofu.wasm can run, so init must never ask the registry
// (it has no raw sockets here): an empty mirror makes unknown providers fail fast.
const cliConfig = `provider_installation {\n  filesystem_mirror {\n    path = "${MIRROR}"\n  }\n}\n`;

export function createMachine(hooks: TtyHooks, onChange: (path: string) => void) {
  const tree = new Tree();
  for (const d of ["/dev", "/etc", "/tmp", MIRROR, HOME, WORKSPACE]) tree.mkdirp(d);
  for (const f of ["tty", "null"]) devFile(tree, f);
  const etc = tree.lookup("/etc");
  if (etc.kind === "dir") etc.children.set("tofurc", newFile(new TextEncoder().encode(cliConfig)));
  tree.cwd = WORKSPACE;
  const tty = new Tty(hooks);
  const fs = createFsApi(tree, tty, onChange);
  const process = {
    pid: 42,
    ppid: 1,
    getuid: () => 1000,
    geteuid: () => 1000,
    getgid: () => 1000,
    getegid: () => 1000,
    getgroups: () => [1000],
    umask: () => 0o022,
    cwd: () => tree.cwd,
    chdir(path: string) {
      const n = tree.lookup(path);
      if (n.kind !== "dir") throw Object.assign(new Error("ENOTDIR"), { code: "ENOTDIR" });
      tree.cwd = path.startsWith("/") ? path : `${tree.cwd}/${path}`;
    },
  };
  return { tree, tty, fs, process };
}

function devFile(tree: Tree, name: string) {
  const dev = tree.lookup("/dev");
  if (dev.kind === "dir") dev.children.set(name, newFile(undefined, 0o666));
}

export function tofuEnv(cols: number, rows: number): Record<string, string> {
  return {
    HOME,
    USER: "user",
    TMPDIR: "/tmp",
    PATH: "/usr/bin",
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    COLUMNS: String(cols),
    LINES: String(rows),
    CHECKPOINT_DISABLE: "1",
    TF_CLI_CONFIG_FILE: CLI_CONFIG,
  };
}
