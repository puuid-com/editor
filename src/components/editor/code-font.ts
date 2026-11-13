import { Compartment } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

import { editorPrefs } from './word-wrap'
import { codeFonts, fontFace, fontProperties } from '#/lib/code-font'
import type { CodeFontId, CodeSize } from '#/lib/code-font'

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
  applySize()
}

/** Sets the text size of every editor and remembers the choice. */
export function setCodeSize(size: CodeSize) {
  editorPrefs.setState((s) => ({ ...s, codeSize: size }))
  applySize()
}

const sizeCompartment = new Compartment()

// A new theme each time, since only a theme change makes CodeMirror measure
// its lines again; a CSS change alone leaves wrapped lines at their old height.
const sizeTheme = () =>
  EditorView.theme({ '&': { fontSize: `${editorPrefs.state.codeSize}px` } })

/** The editor's text size, from the stored choice. */
export function codeSize() {
  return sizeCompartment.of(sizeTheme())
}

/** Re-applies the size to every editor, which re-measures its text. */
function applySize() {
  for (const dom of document.querySelectorAll<HTMLElement>('.cm-editor')) {
    EditorView.findFromDOM(dom)?.dispatch({
      effects: sizeCompartment.reconfigure(sizeTheme()),
    })
  }
}
