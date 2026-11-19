import { ensureSyntaxTree } from '@codemirror/language'

import { fileIdField } from './file-id'
import { docLanguage, docVars } from './language'
import { parseDocument } from '#/lib/document'
import { parseXml } from '#/lib/xml/parse'
import type { Text } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import type { DocLanguage } from '#/lib/document'
import type { XmlDocument } from '#/lib/xml/model'

/**
 * How long the editor's own parser may take to reach the end of an XML file.
 * It keeps what it read, so after the first time only the edited parts are
 * parsed again; should it run out, the text is parsed from scratch instead.
 */
const TREE_BUDGET_MS = 10_000

interface Parse {
  text: Text
  language: DocLanguage
  vars: boolean
  doc: XmlDocument
}

// Retain only the latest parse per view, rather than one per undo state.
const parsed = new WeakMap<EditorView, Parse>()

/** Files whose latest parse is kept after another file takes their editor. */
const KEPT_FILES = 4

// The latest parse of the last few files shown, so going back to a tab
// doesn't read all of its text again. An editor kept for a tab holds on to
// the same text, which is how a kept parse is known to still be good.
const byFile = new Map<string, Parse>()

/** Forgets the parse kept for a file that was deleted or archived. */
export function dropParse(fileId: string) {
  byFile.delete(fileId)
}

function keep(fileId: string, parse: Parse) {
  // Deleted first, so the file moves to the end: the last one shown.
  byFile.delete(fileId)
  byFile.set(fileId, parse)
  if (byFile.size > KEPT_FILES) byFile.delete(byFile.keys().next().value!)
}

/** Share a parse between focus, commands and linting until the text changes. */
export function parseEditor(view: EditorView) {
  const text = view.state.doc
  const language = view.state.facet(docLanguage)
  const vars = view.state.facet(docVars)
  const fresh = (parse: Parse | undefined) =>
    parse?.text === text && parse.language === language && parse.vars === vars
  const cached = parsed.get(view)
  if (cached && fresh(cached)) return cached.doc
  const fileId = view.state.field(fileIdField, false)
  const kept = fileId ? byFile.get(fileId) : undefined
  if (kept && fresh(kept)) {
    parsed.set(view, kept)
    return kept.doc
  }
  const doc =
    language === 'xml'
      ? parseXml(
          text.toString(),
          // The grammar reads the same masked text the model's parse would.
          ensureSyntaxTree(view.state, text.length, TREE_BUDGET_MS) ??
            undefined,
          vars,
        )
      : parseDocument(text.toString(), language, vars)
  const parse = { text, language, vars, doc }
  parsed.set(view, parse)
  if (fileId) keep(fileId, parse)
  return doc
}
