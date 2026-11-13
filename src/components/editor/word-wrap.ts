import { Compartment } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

import { DEFAULT_CODE_SIZE } from '#/lib/code-font'
import { defaultCentered } from '#/lib/md-center'
import { persistedStore } from '#/lib/store/persist'

// Editor preferences shared by every file and kept across reloads.
export const editorPrefs = persistedStore(
  'editor-preferences',
  () => localStorage,
  {
    /** Soft wrapping in every file but Markdown, which always wraps. */
    wordWrap: false,
    codeFont: 'geist-mono',
    codeSize: DEFAULT_CODE_SIZE,
    /** Markdown renders in the editor, as Obsidian's live preview, with no preview panel. */
    markdownLive: false,
    /** Markdown blocks shown in the middle of the page instead of at the start. */
    centered: defaultCentered,
    /** The sidebar sits right of the sheet instead of left. */
    sidebarRight: true,
  },
)

/** Turns soft wrapping of long lines on or off in every editor. */
export function toggleWordWrap() {
  editorPrefs.setState((s) => ({ ...s, wordWrap: !s.wordWrap }))
}

/** Turns soft wrapping on or off in every editor. */
export function setWordWrapPref(on: boolean) {
  editorPrefs.setState((s) => ({ ...s, wordWrap: on }))
}

/** Puts the sidebar right of the sheet, or left. */
export function setSidebarRight(right: boolean) {
  editorPrefs.setState((s) => ({ ...s, sidebarRight: right }))
}

/** Moves the sidebar to the other side of the sheet. */
export function toggleSidebarSide() {
  editorPrefs.setState((s) => ({ ...s, sidebarRight: !s.sidebarRight }))
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
