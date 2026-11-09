/** The monospace fonts the editor and code can use. Add `@font-face` for new ones in `styles.css`. */
export const codeFonts = [
  {
    id: 'geist-mono',
    name: 'Geist Mono',
    stack: "'Geist Mono Variable', ui-monospace, monospace",
  },
  {
    id: 'ioskeley-mono',
    name: 'Ioskeley Mono',
    stack: "'Ioskeley Mono', ui-monospace, monospace",
  },
] as const

export type CodeFontId = (typeof codeFonts)[number]['id']

/** The CSS variable `--font-mono` reads, set on `<html>`. */
export const CODE_FONT_PROPERTY = '--code-font'

// Written by `editorPrefs`, which pulls in the editor and so can't be imported
// by the root route that runs this script.
const preferencesKey = 'xml-editor:editor-preferences'

// Runs before first paint so code never flashes in the default font's place.
export const codeFontScript = `(() => {
  try {
    const stacks = ${JSON.stringify(
      Object.fromEntries(codeFonts.map((font) => [font.id, font.stack])),
    )}
    const id = JSON.parse(localStorage.getItem('${preferencesKey}'))?.codeFont
    if (Object.hasOwn(stacks, id)) {
      document.documentElement.style.setProperty('${CODE_FONT_PROPERTY}', stacks[id])
    }
  } catch {
    // Storage is off or unreadable; the default font stays.
  }
})()`
