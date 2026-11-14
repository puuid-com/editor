import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it, vi } from 'vitest'

import { languageExtension } from './language'
import { longValues, shortenLongValues } from './long-values'

function stateOf(doc: string, language: 'xml' | 'json' = 'xml') {
  return EditorState.create({ doc, extensions: languageExtension(language) })
}

describe('longValues', () => {
  it.each([false, true])(
    'copies the current value after a same-length edit (expanded: %s)',
    (expanded) => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      })
      const view = new EditorView({
        state: EditorState.create({
          doc: `<a>${'x'.repeat(50)}</a>`,
          extensions: [languageExtension('xml'), shortenLongValues(40)],
        }),
        parent: document.body,
      })
      try {
        if (expanded)
          view.dom
            .querySelector<HTMLButtonElement>('.cm-long-value-size')!
            .click()
        view.dispatch({ changes: { from: 3, to: 53, insert: 'y'.repeat(50) } })
        view.dom
          .querySelector<HTMLButtonElement>('.cm-long-value-copy')!
          .click()
        expect(writeText).toHaveBeenCalledWith('y'.repeat(50))
      } finally {
        view.destroy()
        if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard)
        else Reflect.deleteProperty(navigator, 'clipboard')
      }
    },
  )

  it('finds XML text over the limit, without surrounding whitespace', () => {
    const long = 'x'.repeat(50)
    const doc = `<a>\n  <b>${long}</b>\n  <c>short</c>\n  <d>\n    ${long}\n  </d>\n</a>`
    const values = longValues(stateOf(doc), 40)
    expect(values.map((v) => v.text)).toEqual([long, long])
    for (const value of values) {
      expect(doc.slice(value.from, value.to)).toBe(long)
    }
  })

  it('finds JSON string values but not keys', () => {
    const long = 'y'.repeat(50)
    const doc = `{"${long}": "${long}\\n", "k": "v"}`
    const [value, ...rest] = longValues(stateOf(doc, 'json'), 40)
    expect(rest).toEqual([])
    expect(value.text).toBe(`${long}\n`)
    expect(doc.slice(value.from, value.to)).toBe(`${long}\\n`)
  })

  it('finds nothing when the limit is 0', () => {
    expect(longValues(stateOf(`<a>${'z'.repeat(500)}</a>`), 0)).toEqual([])
  })
})
