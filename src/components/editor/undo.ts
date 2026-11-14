import {
  history,
  historyKeymap,
  redo,
  undo,
  undoDepth,
} from '@codemirror/commands'
import { Transaction } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

import { fileIdField } from './file-id'
import { recordTextEdit, redoStep, undoStep } from '#/lib/store/history'
import type { KeyBinding } from '@codemirror/view'

// Puts each file's text history on the app's one undo timeline, so ⌘Z in the
// editor takes back a pin or a colour made after the last edit, and the
// other way round.

function textHistory(view: EditorView) {
  return {
    fileId: view.state.field(fileIdField, false) ?? null,
    undo: () => undo(view),
    redo: () => redo(view),
  }
}

/** Undoes the latest change: this editor's text, or one made elsewhere. */
export function undoIn(view: EditorView | null) {
  return undoStep(view ? textHistory(view) : null)
}

export function redoIn(view: EditorView | null) {
  return redoStep(view ? textHistory(view) : null)
}

/** Notes each step the editor's history gains on the app timeline. */
const recordSteps = EditorView.updateListener.of((update) => {
  if (!update.transactions.length) return
  const replay = update.transactions.some(
    (tr) => tr.isUserEvent('undo') || tr.isUserEvent('redo'),
  )
  if (replay) return
  const kept = update.transactions.some(
    (tr) => tr.docChanged && tr.annotation(Transaction.addToHistory) !== false,
  )
  if (!kept) return
  const fileId = update.state.field(fileIdField, false)
  if (!fileId) return
  const steps = undoDepth(update.state) - undoDepth(update.startState)
  recordTextEdit(fileId, Math.max(steps, 0))
})

/** The editor's history, deep enough that steps rarely fall off its end. */
export function editorHistory() {
  return [history({ minDepth: 1000 }), recordSteps]
}

/** CodeMirror's history keys, going through the app timeline. */
export const historyKeys: ReadonlyArray<KeyBinding> = historyKeymap.map(
  (binding) =>
    binding.run === undo
      ? { ...binding, run: undoIn }
      : binding.run === redo
        ? { ...binding, run: redoIn }
        : binding,
)
