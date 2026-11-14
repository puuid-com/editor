import { docLanguage } from './language'
import { parseDocument } from '#/lib/document'
import type { Text } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import type { DocLanguage } from '#/lib/document'
import type { XmlDocument } from '#/lib/xml/model'

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
  const doc = parseDocument(text.toString(), language)
  parsed.set(view, { text, language, doc })
  return doc
}
