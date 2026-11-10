const MONO = "'Geist Mono Variable', ui-monospace, monospace"

/**
 * The fonts the editor can use. `stack` is for code; a font with `text` sets
 * Markdown's text in the editor and preview, and leaves code in Geist Mono.
 * Add `@font-face` for new ones in `styles.css`.
 */
export const codeFonts = [
  { id: 'geist-mono', name: 'Geist Mono', stack: MONO },
  {
    id: 'ioskeley-mono',
    name: 'Ioskeley Mono',
    stack: "'Ioskeley Mono', ui-monospace, monospace",
  },
  {
    id: 'times-new-roman',
    name: 'Times New Roman',
    stack: MONO,
    text: "'Times New Roman', Times, serif",
  },
] as const satisfies ReadonlyArray<{
  id: string
  name: string
  stack: string
  text?: string
}>

export type CodeFontId = (typeof codeFonts)[number]['id']
type CodeFont = (typeof codeFonts)[number]

/** The CSS variable `--font-mono` reads, set on `<html>`. */
export const CODE_FONT_PROPERTY = '--code-font'
/** Markdown's text font, set on `<html>` only by a font with `text`. */
export const TEXT_FONT_PROPERTY = '--text-font'

/** The font a font's own name is shown in. */
export const fontFace = (font: CodeFont) =>
  'text' in font ? font.text : font.stack

/** The CSS variables a font sets; `null` removes one. */
export const fontProperties = (font: CodeFont) => ({
  [CODE_FONT_PROPERTY]: font.stack,
  [TEXT_FONT_PROPERTY]: 'text' in font ? font.text : null,
})

// Written by `editorPrefs`, which pulls in the editor and so can't be imported
// by the root route that runs this script.
export const PREFERENCES_KEY = 'xml-editor:editor-preferences'

// Runs before first paint so code never flashes in the default font's place.
export const codeFontScript = `(() => {
  try {
    const fonts = ${JSON.stringify(
      Object.fromEntries(
        codeFonts.map((font) => [font.id, fontProperties(font)]),
      ),
    )}
    const id = JSON.parse(localStorage.getItem('${PREFERENCES_KEY}'))?.codeFont
    if (Object.hasOwn(fonts, id)) {
      for (const [name, value] of Object.entries(fonts[id])) {
        if (value) document.documentElement.style.setProperty(name, value)
      }
    }
  } catch {
    // Storage is off or unreadable; the default font stays.
  }
})()`
