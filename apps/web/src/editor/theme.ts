// Monaco theme matching the app palette.
import * as monaco from "monaco-editor";

export const THEME = "tofu-dark";

export function registerTheme() {
  monaco.editor.defineTheme(THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6d685e", fontStyle: "italic" },
      { token: "keyword.block", foreground: "ffda18" },
      { token: "type.block", foreground: "f0a35e" },
      { token: "keyword", foreground: "ffda18" },
      { token: "attribute", foreground: "9ec7ff" },
      { token: "string", foreground: "b9dc8f" },
      { token: "string.heredoc", foreground: "b9dc8f" },
      { token: "string.escape", foreground: "7fd4a6" },
      { token: "delimiter.interp", foreground: "f0a35e" },
      { token: "number", foreground: "f7c06a" },
      { token: "constant", foreground: "f7c06a" },
      { token: "function", foreground: "e3a8ff" },
      { token: "variable.root", foreground: "7fd4a6" },
      { token: "identifier", foreground: "ece7dc" },
      { token: "operator", foreground: "b8b2a5" },
    ],
    colors: {
      "editor.background": "#131210",
      "editor.foreground": "#ece7dc",
      "editorLineNumber.foreground": "#4d4a43",
      "editorLineNumber.activeForeground": "#ece7dc",
      "editor.lineHighlightBackground": "#1d1b18",
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": "#ffda1830",
      "editor.inactiveSelectionBackground": "#ffda1818",
      "editorCursor.foreground": "#ffda18",
      "editorIndentGuide.background1": "#24221e",
      "editorIndentGuide.activeBackground1": "#3a3731",
      "editorWidget.background": "#1d1b18",
      "editorWidget.border": "#2c2a25",
      "editorSuggestWidget.background": "#1d1b18",
      "editorSuggestWidget.border": "#2c2a25",
      "editorSuggestWidget.selectedBackground": "#2c2a25",
      "editorHoverWidget.background": "#1d1b18",
      "editorHoverWidget.border": "#2c2a25",
      "editorError.foreground": "#ff8a7a",
      "editorWarning.foreground": "#f7c06a",
      "scrollbarSlider.background": "#2c2a2580",
      "scrollbarSlider.hoverBackground": "#3a3731",
    },
  });
}
