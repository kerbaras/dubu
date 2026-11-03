// xterm.js setup themed to match the app.
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";

export function createTerminal(host: HTMLElement) {
  const term = new Terminal({
    convertEol: true,
    cursorBlink: true,
    fontFamily: '"JetBrains Mono Variable", ui-monospace, monospace',
    fontSize: 13,
    lineHeight: 1.25,
    scrollback: 5000,
    allowProposedApi: true,
    theme: {
      background: "#131210",
      foreground: "#ece7dc",
      cursor: "#ffda18",
      cursorAccent: "#131210",
      selectionBackground: "#ffda1840",
      black: "#22201c", brightBlack: "#6b665b",
      red: "#ff8a7a", brightRed: "#ffa898",
      green: "#7fd4a6", brightGreen: "#9fe6bf",
      yellow: "#ffda18", brightYellow: "#ffe55c",
      blue: "#8fb6ff", brightBlue: "#afcbff",
      magenta: "#e3a8ff", brightMagenta: "#eec4ff",
      cyan: "#6fd3c1", brightCyan: "#93e3d5",
      white: "#ece7dc", brightWhite: "#ffffff",
    },
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.loadAddon(new WebLinksAddon());
  term.open(host);
  const refit = () => {
    try {
      fit.fit();
    } catch {
      /* host not visible yet */
    }
  };
  new ResizeObserver(refit).observe(host);
  refit();
  return term;
}
