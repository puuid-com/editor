import { Compartment, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { fileIdField } from './file-id'
import { docLanguage, languageExtension } from './language'
import { dropParse, parseEditor } from './parse'
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

  describe('across files sharing one editor', () => {
    const fileState = (id: string, doc: string) =>
      EditorState.create({
        doc,
        extensions: [fileIdField.init(() => id), docLanguage.of('xml')],
      })

    function shared(...states: Array<EditorState>) {
      const view = new EditorView({ state: states[0] })
      views.push(view)
      return view
    }

    it('keeps the parse of a file for when its tab comes back', () => {
      const a = fileState('kept-a', '<a>1</a>')
      const b = fileState('kept-b', '<b>2</b>')
      const view = shared(a)
      const first = parseEditor(view)
      view.setState(b)
      expect(parseEditor(view).root?.name).toBe('b')
      view.setState(a)
      const stringify = vi.spyOn(view.state.doc, 'toString')
      expect(parseEditor(view)).toBe(first)
      expect(stringify).not.toHaveBeenCalled()
    })

    it('parses again when the file changed while its tab was away', () => {
      const a = fileState('edited-a', '<a>1</a>')
      const view = shared(a)
      const first = parseEditor(view)
      view.setState(fileState('edited-b', '<b/>'))
      parseEditor(view)
      // As a change made in another browser tab would be applied.
      view.setState(
        a.update({ changes: { from: 3, to: 4, insert: '2' } }).state,
      )
      const again = parseEditor(view)
      expect(again).not.toBe(first)
      expect(again.root?.children[0]).toMatchObject({ value: '2' })
    })

    it('keeps the last few files only, and none that was dropped', () => {
      const states = Array.from({ length: 6 }, (_, i) =>
        fileState(`many-${i}`, `<f${i}/>`),
      )
      const view = shared(...states)
      const docs = states.map((state) => {
        view.setState(state)
        return parseEditor(view)
      })
      const again = (index: number) => {
        view.setState(states[index])
        return parseEditor(view)
      }
      // The most recent ones are kept; the first to be shown are not.
      expect(again(5)).toBe(docs[5])
      expect(again(3)).toBe(docs[3])
      expect(again(0)).not.toBe(docs[0])
      dropParse('many-4')
      expect(again(4)).not.toBe(docs[4])
      expect(again(4)).toEqual(docs[4])
    })
  })
})
