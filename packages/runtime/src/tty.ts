// Terminal line discipline between the user's keystrokes and the process'
// stdin. Cooked mode handles echo and line editing; raw mode (used by tofu's
// interactive console via readline) passes bytes through untouched.
import type { Stdio } from "./vfs/fds";

const enc = new TextEncoder();

export interface TtyHooks {
  output(data: Uint8Array): void;
  interrupt(): void;
}

export class Tty implements Stdio {
  raw = false;
  echo = true;
  cols = 80;
  rows = 24;
  private line: number[] = [];
  private ready: Uint8Array[] = [];
  private eof = false;
  private waiter?: { max: number; resolve: (b: Uint8Array) => void };

  constructor(private hooks: TtyHooks) {}

  write(_fd: 1 | 2, data: Uint8Array) {
    this.hooks.output(data);
  }

  read(max: number): Promise<Uint8Array> {
    return new Promise((resolve) => {
      this.waiter = { max, resolve };
      this.flush();
    });
  }

  /** Feeds keyboard input (as delivered by xterm.js onData). */
  input(text: string) {
    const bytes = enc.encode(text);
    if (this.raw) {
      this.ready.push(bytes);
    } else {
      for (const b of bytes) this.cooked(b);
    }
    this.flush();
  }

  private cooked(b: number) {
    const out = (s: string) => this.echo && this.hooks.output(enc.encode(s));
    if (b === 0x03) {
      out("^C\n");
      this.line = [];
      this.hooks.interrupt();
    } else if (b === 0x04) {
      if (this.line.length) this.commit();
      else this.eof = true;
    } else if (b === 0x0d || b === 0x0a) {
      this.line.push(0x0a);
      out("\n");
      this.commit();
    } else if (b === 0x7f || b === 0x08) {
      if (this.line.length) {
        // Drop a whole UTF-8 sequence, not just its last byte.
        let c: number | undefined;
        do c = this.line.pop();
        while (c !== undefined && (c & 0xc0) === 0x80);
        out("\b \b");
      }
    } else if (b === 0x15) {
      out("\b \b".repeat(this.line.length));
      this.line = [];
    } else if (b >= 0x20 || b === 0x09 || b >= 0x80) {
      this.line.push(b);
      if (b < 0x80 || (b & 0xc0) === 0xc0) out(b < 0x80 ? String.fromCharCode(b) : "");
    }
  }

  private commit() {
    this.ready.push(Uint8Array.from(this.line));
    this.line = [];
  }

  private flush() {
    const w = this.waiter;
    if (!w) return;
    if (this.ready.length) {
      const head = this.ready[0];
      const chunk = head.subarray(0, w.max);
      if (chunk.length === head.length) this.ready.shift();
      else this.ready[0] = head.subarray(w.max);
      this.waiter = undefined;
      w.resolve(chunk.slice());
    } else if (this.eof) {
      this.eof = false;
      this.waiter = undefined;
      w.resolve(new Uint8Array(0));
    }
  }

  /** Queues non-interactive input followed by EOF (e.g. for `tofu fmt -`). */
  preload(text: string) {
    this.ready.push(enc.encode(text));
    this.eof = true;
  }

  /** Drops pending input; used when a process exits. */
  reset() {
    this.line = [];
    this.ready = [];
    this.eof = false;
    this.raw = false;
    this.echo = true;
    this.waiter = undefined;
  }

  /** The object the Go terminal shims look up as globalThis.__tofuTTY. */
  bridge() {
    const t = this;
    return {
      isatty: (fd: number) => fd <= 2,
      setRaw: (on: boolean) => {
        const old = this.raw;
        this.raw = on;
        return old;
      },
      setEcho: (on: boolean) => {
        const old = this.echo;
        this.echo = on;
        return old;
      },
      get raw() {
        return t.raw;
      },
      get cols() {
        return t.cols;
      },
      get rows() {
        return t.rows;
      },
    };
  }
}
