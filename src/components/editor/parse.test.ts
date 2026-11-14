import { Compartment, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { docLanguage, languageExtension } from './language'
import { parseEditor } from './parse'
import { parseDocument } from '#/lib/document'

const views: Array<EditorView> = []

afterEach(() => {
  views.splice(0).forEach((view) => view.destroy())
  vi.restoreAllMocks()
})

function editor() {
  const language = new Compartment()
  const view = new EditorView({
    state: EditorState.create({
      doc: '<root>value</root>',
      extensions: language.of(docLanguage.of('xml')),
    }),
  })
  views.push(view)
  return { view, language }
}

describe('editor parse cache', () => {
  it('reuses the parsed model without serializing the text on cursor changes', () => {
    const { view } = editor()
    const stringify = vi.spyOn(view.state.doc, 'toString')
    const doc = parseEditor(view)
    expect(stringify).toHaveBeenCalledTimes(1)
    view.dispatch({ selection: { anchor: 7 } })
    expect(parseEditor(view)).toBe(doc)
    expect(stringify).toHaveBeenCalledTimes(1)
  })

  it('refreshes after an edit, even one that preserves the document length', () => {
    const { view } = editor()
    const doc = parseEditor(view)
    view.dispatch({ changes: { from: 6, to: 11, insert: 'other' } })
    const changed = parseEditor(view)
    expect(changed).not.toBe(doc)
    expect(changed.root?.children[0]).toMatchObject({ value: 'other' })
    expect(parseEditor(view)).toBe(changed)
  })

  it("builds XML from the editor's syntax tree as a fresh parse would", () => {
    const text = [
      '<?xml version="1.0"?>',
      '<order id="<<id>>" note="a &amp; b">',
      '  <line qty="{{qty}}">${price}</line>',
      '  <bad>&nbsp;</bad>',
      '  <unclosed>',
      '</order>',
    ].join('\n')
    const view = new EditorView({
      state: EditorState.create({
        doc: text,
        extensions: languageExtension('xml'),
      }),
    })
    views.push(view)
    expect(parseEditor(view)).toEqual(parseDocument(text, 'xml'))
    view.dispatch({ changes: { from: 0, insert: '<!-- edited -->\n' } })
    const edited = view.state.doc.toString()
    expect(parseEditor(view)).toEqual(parseDocument(edited, 'xml'))
  })

  it('masks variables that cross where the editor reads in blocks', () => {
    const items: Array<string> = []
    // Variables at every offset around the first 16K block's end.
    for (let i = 0; items.join('').length < 40_000; i++)
      items.push(`<v a="<<name${i}>>">x<<value${i}>>y</v>`)
    const text = `<r>${items.join('')}</r>`
    const view = new EditorView({
      state: EditorState.create({
        doc: text,
        extensions: languageExtension('xml'),
      }),
    })
    views.push(view)
    const doc = parseEditor(view)
    expect(doc.errors).toEqual([])
    expect(doc).toEqual(parseDocument(text, 'xml'))
  })

  it('refreshes when the language changes without changing the text', () => {
    const { view, language } = editor()
    const doc = parseEditor(view)
    view.dispatch({ effects: language.reconfigure(docLanguage.of('txt')) })
    expect(parseEditor(view)).not.toBe(doc)
    expect(parseEditor(view)).toMatchObject({ language: 'txt', nodes: [] })
  })
})
