import { Transaction } from '@codemirror/state'
import { Store } from '@tanstack/store'
import type { ChangeSet, EditorSelection } from '@codemirror/state'
import type { EditorView, ViewUpdate } from '@codemirror/view'

import { remoteSync } from './editor-session'
import { typedName } from '#/lib/document'
import { m } from '#/paraglide/messages'
import type { DocLanguage } from '#/lib/document'

// With no tab open, the editor shows a draft: an empty buffer that is not a
// file yet. Its first edit creates the file. The edits made until that file's
// editor opens are played again there, so undo, paste detection and the
// cursor carry on as if they had been made in it.

/** The type the draft's file will get; null lets its content decide. */
export const draftStore = new Store<{ language: DocLanguage | null }>({
  language: null,
})

export function setDraftLanguage(language: DocLanguage | null) {
  draftStore.setState(() => ({ language }))
}

/** The name the draft's file gets for `language`. */
export function draftName(language: DocLanguage | null) {
  const name = m.file_untitled()
  return language ? typedName(name, language) : name
}

interface Edit {
  changes: ChangeSet
  selection: EditorSelection | undefined
  scrollIntoView: boolean
  userEvent: string | undefined
}

let held: { fileId: string; doc: string; edits: Array<Edit> } | null = null

/** Keeps the edits of a draft update, made for `fileId`, to replay in its editor. */
export function holdDraftEdits(fileId: string, update: ViewUpdate) {
  if (held?.fileId !== fileId) held = { fileId, doc: '', edits: [] }
  for (const tr of update.transactions) {
    if (!tr.docChanged) continue
    held.edits.push({
      changes: tr.changes,
      selection: tr.selection,
      scrollIntoView: tr.scrollIntoView,
      userEvent: tr.annotation(Transaction.userEvent),
    })
  }
  held.doc = update.state.doc.toString()
}

/**
 * Plays the draft's edits again in the editor that opened their file. It
 * already shows their text, saved as it was typed, so it is emptied first,
 * unsaved and outside the history. If the text has changed since, it stays.
 */
export function replayDraftEdits(fileId: string, view: EditorView) {
  if (held?.fileId !== fileId) return
  const { doc, edits } = held
  held = null
  if (view.state.doc.toString() !== doc) return
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length },
    annotations: [remoteSync.of(true), Transaction.addToHistory.of(false)],
  })
  for (const edit of edits) {
    // An edit the editor changed, such as a pasted base64 label it decoded,
    // no longer lines up with the ones after it.
    if (edit.changes.length !== view.state.doc.length) break
    view.dispatch(edit)
  }
}
