import { Compartment } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

import { persistedStore } from '#/lib/store/persist'

// Editor preferences shared by every file and kept across reloads.
export const editorPrefs = persistedStore(
  'editor-preferences',
  () => localStorage,
  {
    wordWrap: false,
    codeFont: 'geist-mono',
  },
)

/** Turns soft wrapping of long lines on or off in every editor. */
export function toggleWordWrap() {
  editorPrefs.setState((s) => ({ ...s, wordWrap: !s.wordWrap }))
}

const wrapCompartment = new Compartment()

/** The wrap extension, starting from the stored preference. */
export function wordWrap() {
  return wrapCompartment.of(wrapping(editorPrefs.state.wordWrap))
}

/** Effect that switches an editor's wrapping to `on`. */
export function setWordWrap(on: boolean) {
  return wrapCompartment.reconfigure(wrapping(on))
}

function wrapping(on: boolean) {
  return on ? EditorView.lineWrapping : []
}
