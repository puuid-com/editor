import { EditorView } from '@codemirror/view'

import { editorPrefs } from './word-wrap'
import { codeFonts, fontFace, fontProperties } from '#/lib/code-font'
import type { CodeFontId } from '#/lib/code-font'

/** Switches every editor and code block to a font and remembers the choice. */
export async function setCodeFont(id: CodeFontId) {
  const font = codeFonts.find((f) => f.id === id)!
  editorPrefs.setState((s) => ({ ...s, codeFont: id }))
  try {
    // Waiting keeps the fallback font from showing while this one downloads.
    await document.fonts.load(`13px ${fontFace(font)}`)
  } catch {
    // Offline: the stack falls back until the font can load.
  }
  // A later pick may have finished first.
  if (editorPrefs.state.codeFont !== id) return
  const { style } = document.documentElement
  for (const [name, value] of Object.entries(fontProperties(font))) {
    if (value) style.setProperty(name, value)
    else style.removeProperty(name)
  }
  for (const dom of document.querySelectorAll<HTMLElement>('.cm-editor')) {
    const view = EditorView.findFromDOM(dom)
    // The cursor and selection are drawn from measurements of the old font.
    view?.dispatch({ selection: view.state.selection })
  }
}
