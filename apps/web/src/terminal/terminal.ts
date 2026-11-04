// xterm.js setup; colours come from the active theme (theme/engine.ts).
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
    minimumContrastRatio: 4.5,
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
