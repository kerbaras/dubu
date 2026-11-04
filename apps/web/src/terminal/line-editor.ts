// Readline-style editing for the sandbox shell prompt.
export interface LineEvents {
  write(s: string): void;
  submit(line: string): void;
  complete(line: string): string[];
  clear(): void;
}

export class LineEditor {
  private buf = "";
  private cur = 0;
  private history: string[] = [];
  private hpos = 0;

  constructor(
    private prompt: () => string,
    private ev: LineEvents,
  ) {}

  get line() {
    return this.buf;
  }

  showPrompt() {
    this.buf = "";
    this.cur = 0;
    this.hpos = this.history.length;
    this.ev.write(this.prompt());
  }

  private redraw() {
    this.ev.write(`\r\x1b[2K${this.prompt()}${this.buf}`);
    const back = this.buf.length - this.cur;
    if (back > 0) this.ev.write(`\x1b[${back}D`);
  }

  private set(text: string, cur = text.length) {
    this.buf = text;
    this.cur = cur;
    this.redraw();
  }

  input(data: string) {
    const seqs: Record<string, () => void> = {
      "\r": () => this.enter(),
      "\x7f": () => this.cur > 0 && this.set(this.buf.slice(0, this.cur - 1) + this.buf.slice(this.cur), this.cur - 1),
      "\x1b[3~": () => this.set(this.buf.slice(0, this.cur) + this.buf.slice(this.cur + 1), this.cur),
      "\x1b[D": () => this.cur > 0 && this.set(this.buf, this.cur - 1),
      "\x1b[C": () => this.cur < this.buf.length && this.set(this.buf, this.cur + 1),
      "\x1b[H": () => this.set(this.buf, 0),
      "\x01": () => this.set(this.buf, 0),
      "\x1b[F": () => this.set(this.buf),
      "\x05": () => this.set(this.buf),
      "\x1b[A": () => this.walk(-1),
      "\x1b[B": () => this.walk(1),
      "\x15": () => this.set(this.buf.slice(this.cur), 0),
      "\x0b": () => this.set(this.buf.slice(0, this.cur)),
      "\x17": () => {
        const left = this.buf.slice(0, this.cur).replace(/\S+\s*$/, "");
        this.set(left + this.buf.slice(this.cur), left.length);
      },
      "\x03": () => (this.ev.write("^C\r\n"), this.showPrompt()),
      "\x0c": () => (this.ev.clear(), this.redraw()),
      "\t": () => this.tab(),
    };
    const fn = seqs[data];
    if (fn) return void fn();
    const text = data.replace(/[\x00-\x1f]|\x1b\[[0-9;]*[A-Za-z~]/g, (m) => (m === "\r" || m === "\n" ? " " : ""));
    if (text) this.set(this.buf.slice(0, this.cur) + text + this.buf.slice(this.cur), this.cur + text.length);
  }

  private enter() {
    const line = this.buf;
    this.ev.write("\r\n");
    if (line.trim() && this.history.at(-1) !== line) this.history.push(line);
    this.ev.submit(line);
  }

  private walk(d: number) {
    const next = Math.min(this.history.length, Math.max(0, this.hpos + d));
    if (next === this.hpos) return;
    this.hpos = next;
    this.set(this.history[next] ?? "");
  }

  private tab() {
    const left = this.buf.slice(0, this.cur);
    const opts = this.ev.complete(left);
    if (opts.length === 1) {
      const word = left.split(/\s+/).at(-1) ?? "";
      const add = opts[0].slice(word.length) + (opts[0].endsWith("/") ? "" : " ");
      this.set(left + add + this.buf.slice(this.cur), this.cur + add.length);
    } else if (opts.length > 1) {
      this.ev.write(`\r\n${opts.join("  ")}\r\n`);
      this.redraw();
    }
  }
}
