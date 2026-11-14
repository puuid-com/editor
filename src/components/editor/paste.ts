import { EditorState } from '@codemirror/state'
import type { Transaction } from '@codemirror/state'

// Content of files nobody has written in yet: the old new-file template,
// still in tabs opened before files started empty, and the JSON one.
const STARTERS = new Set([
  '<?xmlversion="1.0"encoding="UTF-8"?><root></root>',
  '{}',
])

/**
 * Longer than any starter with room for its whitespace, so pasting into a
 * real document doesn't copy and scan all of it.
 */
const STARTER_MAX_LENGTH = 1000

function isStarter(text: string) {
  return STARTERS.has(text.replace(/\s+/g, ''))
}

function insertedText(tr: Transaction) {
  let inserted = ''
  tr.changes.iterChanges((_fromA, _toA, _fromB, _toB, text) => {
    inserted += text.toString()
  })
  return inserted
}

/**
 * The document after a paste that makes up all of it, such as into an empty
 * file or over a full selection; otherwise null.
 */
export function pastedWhole(tr: Transaction): string | null {
  if (!tr.docChanged || !tr.isUserEvent('input.paste')) return null
  const inserted = insertedText(tr).trim()
  // Pasted into a document with more in it: no need to copy all of it.
  if (inserted === '' || keptText(tr)) return null
  const text = tr.newDoc.toString()
  return text.trim() === inserted ? text : null
}

/** Whether the paste left text other than whitespace in place. */
function keptText(tr: Transaction) {
  let kept = false
  tr.changes.iterGaps((from, _to, length) => {
    if (kept) return
    const iter = tr.startState.doc.iterRange(from, from + length)
    while (!kept && !iter.next().done) kept = /\S/.test(iter.value)
  })
  return kept
}

/** Pasting into an untouched starter template replaces the template. */
export const pasteOverStarter = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || !tr.isUserEvent('input.paste')) return tr
  if (tr.startState.doc.length > STARTER_MAX_LENGTH) return tr
  const before = tr.startState.doc.toString()
  if (before.trim() === '' || !isStarter(before)) return tr
  const inserted = insertedText(tr)
  if (inserted.trim() === '') return tr
  return {
    changes: { from: 0, to: before.length, insert: inserted },
    selection: { anchor: inserted.length },
    userEvent: 'input.paste',
    scrollIntoView: true,
  }
})
