import { ensureSyntaxTree } from '@codemirror/language'

import { docLanguage } from './language'
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

// Retain only the latest parse per view, rather than one per undo state.
const parsed = new WeakMap<
  EditorView,
  { text: Text; language: DocLanguage; doc: XmlDocument }
>()

/** Share a parse between focus, commands and linting until the text changes. */
export function parseEditor(view: EditorView) {
  const text = view.state.doc
  const language = view.state.facet(docLanguage)
  const cached = parsed.get(view)
  if (cached?.text === text && cached.language === language) return cached.doc
  const doc =
    language === 'xml'
      ? parseXml(
          text.toString(),
          // The grammar reads the same masked text the model's parse would.
          ensureSyntaxTree(view.state, text.length, TREE_BUDGET_MS) ??
            undefined,
        )
      : parseDocument(text.toString(), language)
  parsed.set(view, { text, language, doc })
  return doc
}
