import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'

import { languageExtension } from './language'
import { namesParent } from './syntax'

/** The tag names or JSON keys of `doc` that open an element holding others. */
function parents(doc: string, language: 'xml' | 'json') {
  const state = EditorState.create({
    doc,
    extensions: languageExtension(language),
  })
  const names: Array<string> = []
  ensureSyntaxTree(state, doc.length, 5000)!.iterate({
    enter(node) {
      if (namesParent(node.node)) names.push(doc.slice(node.from, node.to))
    },
  })
  return names
}

describe('namesParent', () => {
  it('marks the tags of XML elements that hold elements', () => {
    expect(
      parents(
        '<a><b>text</b><c><d/></c><e>mixed <f>x</f> text</e><g></g></a>',
        'xml',
      ),
      // Opening and closing tags both, and never a self-closing one.
    ).toEqual(['a', 'c', 'c', 'e', 'e', 'a'])
  })

  it('finds an element after any amount of text, comments and entities', () => {
    const filler = 'text &amp; <!-- note --> '.repeat(500)
    expect(parents(`<a>${filler}<b/></a>`, 'xml')).toEqual(['a', 'a'])
    expect(parents(`<a>${filler}</a>`, 'xml')).toEqual([])
  })

  it('marks every tag of a parent with thousands of children', () => {
    const rows = Array.from({ length: 3000 }, (_, i) => `<r><v>${i}</v></r>`)
    const names = parents(`<rows>${rows.join('')}</rows>`, 'xml')
    expect(names.filter((name) => name === 'rows')).toHaveLength(2)
    expect(names.filter((name) => name === 'r')).toHaveLength(6000)
    expect(names).not.toContain('v')
  })

  it('marks the JSON keys of objects and arrays', () => {
    expect(
      parents('{"a": {"b": 1}, "c": [1, 2], "d": "text", "e": null}', 'json'),
    ).toEqual(['"a"', '"c"'])
  })
})
