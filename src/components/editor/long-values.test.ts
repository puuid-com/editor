import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it, vi } from 'vitest'

import { languageExtension } from './language'
import { longValues, shortenLongValues, valueText } from './long-values'

function stateOf(doc: string, language: 'xml' | 'json' | 'sql' = 'xml') {
  return EditorState.create({ doc, extensions: languageExtension(language) })
}

/** `state` with its whole document parsed, as the editor has it once idle. */
function parsed(state: EditorState) {
  ensureSyntaxTree(state, state.doc.length, 10_000)
  return state.update({}).state
}

/**
 * Long values found by walking every node of the tree, as they were looked
 * for before finds were kept between edits.
 */
function everyNode(state: EditorState, limit: number) {
  const values: Array<{ from: number; to: number; json: boolean }> = []
  syntaxTree(state).iterate({
    enter(node) {
      if (node.to - node.from <= limit) return false
      if (node.name === 'Text') {
        const text = state.sliceDoc(node.from, node.to)
        const from = node.from + (text.length - text.trimStart().length)
        const to = node.to - (text.length - text.trimEnd().length)
        if (to - from > limit) values.push({ from, to, json: false })
        return false
      }
      if (node.name === 'String') {
        if (node.to - node.from - 2 > limit)
          values.push({ from: node.from + 1, to: node.to - 1, json: true })
        return false
      }
      return undefined
    },
  })
  return values
}

function found(state: EditorState, limit: number) {
  return longValues(state, limit).map(({ from, to, json }) => ({
    from,
    to,
    json,
  }))
}

/** A repeatable stand-in for Math.random. */
function random(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
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

  it.each([
    [
      'xml',
      (i: number, long: boolean) =>
        `  <order id="${i}" note="${'n'.repeat(long ? 90 : 3)}">\n    <name>  ${'x'.repeat(long ? 60 + (i % 900) : 8)}  </name><!-- ${'c'.repeat(long ? 70 : 2)} -->\n    <data><![CDATA[${'d'.repeat(long ? 80 : 4)}]]></data>\n  </order>\n`,
      (rows: string) => `<orders>\n${rows}</orders>\n`,
    ],
    [
      'json',
      (i: number, long: boolean) =>
        `  {"id": ${i}, "${'k'.repeat(long ? 70 : 3)}": "${'v'.repeat(long ? 60 + (i % 900) : 8)}\\n", "tags": ["a", "${'t'.repeat(long ? 45 : 2)}"]},\n`,
      (rows: string) => `[\n${rows}  {}\n]\n`,
    ],
    [
      'sql',
      (i: number, long: boolean) =>
        `insert into t values (${i}, '${'s'.repeat(long ? 60 + (i % 900) : 8)}');\n`,
      (rows: string) => rows,
    ],
  ] as const)(
    'finds the same %s values as a walk of every node, edit after edit',
    (language, row, wrap) => {
      const next = random(7)
      const rows = Array.from({ length: 1500 }, (_, i) => row(i, next() < 0.05))
      let state = parsed(stateOf(wrap(rows.join('')), language))
      expect(found(state, 40)).toEqual(everyNode(state, 40))
      expect(found(state, 40).length).toBeGreaterThan(20)
      // Another limit keeps finds of its own.
      expect(found(state, 100)).toEqual(everyNode(state, 100))

      for (let edit = 0; edit < 40; edit++) {
        const at = Math.floor(next() * state.doc.length)
        const kind = next()
        const changes =
          kind < 0.4
            ? { from: at, insert: 'y'.repeat(1 + Math.floor(next() * 80)) }
            : kind < 0.7
              ? { from: at, to: Math.min(state.doc.length, at + 60) }
              : // Markup that changes how what follows it reads.
                { from: at, insert: ['<', '"', "'", '<!--', ']]>'][edit % 5] }
        state = parsed(state.update({ changes }).state)
        expect(found(state, 40)).toEqual(everyNode(state, 40))
        expect(found(state, 100)).toEqual(everyNode(state, 100))
      }
    },
  )
})
