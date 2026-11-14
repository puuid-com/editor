import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it, vi } from 'vitest'

import { languageExtension } from './language'
import { longValues, shortenLongValues, valueText } from './long-values'

function stateOf(doc: string, language: 'xml' | 'json' = 'xml') {
  return EditorState.create({ doc, extensions: languageExtension(language) })
}

function withClipboard(run: (writeText: ReturnType<typeof vi.fn>) => void) {
  const writeText = vi.fn().mockResolvedValue(undefined)
  const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
  try {
    run(writeText)
  } finally {
    if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard)
    else Reflect.deleteProperty(navigator, 'clipboard')
  }
}

describe('longValues', () => {
  it.each([false, true])(
    'copies the current value after a same-length edit (expanded: %s)',
    (expanded) => {
      withClipboard((writeText) => {
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
          view.dispatch({
            changes: { from: 3, to: 53, insert: 'y'.repeat(50) },
          })
          view.dom
            .querySelector<HTMLButtonElement>('.cm-long-value-copy')!
            .click()
          expect(writeText).toHaveBeenCalledWith('y'.repeat(50))
        } finally {
          view.destroy()
        }
      })
    },
  )

  it('copies a value moved by an edit before it', () => {
    withClipboard((writeText) => {
      const view = new EditorView({
        state: EditorState.create({
          doc: `<a><b>${'x'.repeat(50)}</b></a>`,
          extensions: [languageExtension('xml'), shortenLongValues(40)],
        }),
        parent: document.body,
      })
      try {
        view.dispatch({ changes: { from: 3, insert: '<c>1</c>' } })
        view.dom
          .querySelector<HTMLButtonElement>('.cm-long-value-copy')!
          .click()
        expect(writeText).toHaveBeenCalledWith('x'.repeat(50))
      } finally {
        view.destroy()
      }
    })
  })

  it('finds XML text over the limit, without surrounding whitespace', () => {
    const long = 'x'.repeat(50)
    const doc = `<a>\n  <b>${long}</b>\n  <c>short</c>\n  <d>\n    ${long}\n  </d>\n</a>`
    const state = stateOf(doc)
    const values = longValues(state, 40)
    expect(values.map((v) => valueText(state, v))).toEqual([long, long])
    for (const value of values) {
      expect(doc.slice(value.from, value.to)).toBe(long)
    }
  })

  it('trims whitespace longer than one read at either end', () => {
    const long = 'z'.repeat(60)
    const pad = ' '.repeat(150)
    const doc = `<a>\n${pad}${long}${pad}\n</a>`
    const [value, ...rest] = longValues(stateOf(doc), 40)
    expect(rest).toEqual([])
    expect(doc.slice(value.from, value.to)).toBe(long)
  })

  it('finds JSON string values but not keys', () => {
    const long = 'y'.repeat(50)
    const doc = `{"${long}": "${long}\\n", "k": "v"}`
    const state = stateOf(doc, 'json')
    const [value, ...rest] = longValues(state, 40)
    expect(rest).toEqual([])
    expect(valueText(state, value)).toBe(`${long}\n`)
    expect(doc.slice(value.from, value.to)).toBe(`${long}\\n`)
  })

  it('sizes values in UTF-8 bytes', () => {
    const doc = `<a>${'é'.repeat(30)}${'😀'.repeat(10)}</a>`
    const [value] = longValues(stateOf(doc), 40)
    expect(value.size).toBe(
      String(new TextEncoder().encode(valueText(stateOf(doc), value)).length) +
        ' B',
    )
  })

  it('keeps the size of values an edit did not touch', () => {
    const long = 'x'.repeat(50)
    const state = stateOf(`<a><b>${long}</b><c>${long}</c></a>`)
    const [first, second] = longValues(state, 40)
    const known = new Map([
      [first.from, first],
      [second.from, { ...second, size: 'kept' }],
    ])
    const again = longValues(state, 40, known)
    expect(again[0]).toBe(first)
    expect(again[1].size).toBe('kept')
  })

  it('finds nothing when the limit is 0', () => {
    expect(longValues(stateOf(`<a>${'z'.repeat(500)}</a>`), 0)).toEqual([])
  })
})
