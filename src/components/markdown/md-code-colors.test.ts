import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { act } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { codeAt, inlineCodes, recolor } from './md-code-colors'
import { markdownSupport } from './md-language'
import type { HighlightPreset } from '#/lib/store/colors'

const views: Array<EditorView> = []

afterEach(() => {
  views.splice(0).forEach((view) => view.destroy())
  document.body.innerHTML = ''
})

/** An editor on `doc`, with `^` marking the caret if there is one. */
function editor(doc: string) {
  const caret = Math.max(0, doc.indexOf('^'))
  const text = doc.replace('^', '')
  const view = new EditorView({
    state: EditorState.create({
      doc: text,
      selection: { anchor: caret },
      extensions: [markdownSupport()],
    }),
    parent: document.body,
  })
  ensureSyntaxTree(view.state, text.length, 5000)
  views.push(view)
  return view
}

/** The document with `color` applied to the code around `^`. */
function colored(doc: string, color: HighlightPreset | null) {
  const view = editor(doc)
  const { state } = view
  const code = codeAt(state, state.selection.main.head)!
  const edit = recolor(state, code, color)
  if (!edit) return null
  const text = state.doc.toString()
  return text.slice(0, edit.from) + edit.insert + text.slice(edit.to)
}

/** The spans of the editor showing `text`. */
const spans = (view: EditorView, text: string) =>
  [...view.contentDOM.querySelectorAll<HTMLElement>('span')].filter(
    (span) => span.textContent === text,
  )

describe('HTML code as it is typed', () => {
  it('shows the text in its colour, its tags as backticks', () => {
    const view = editor(
      'A <code style="color: red">deploy</code> <code>plain</code> <code style="color: #f80">own</code>',
    )
    const [red] = spans(view, 'deploy')
    expect(red.className).toBe('md-inline-code md-code-color')
    expect(red.style.getPropertyValue('--md-code')).toBe('var(--hl-red)')
    expect(spans(view, 'plain')[0].style.getPropertyValue('--md-code')).toBe(
      'var(--hl-blue)',
    )
    expect(spans(view, 'own')[0].style.getPropertyValue('--md-code')).toBe(
      '#f80',
    )
    // The tags read as a code span's backticks.
    expect(view.contentDOM.textContent).toBe('A `deploy` `plain` `own`')
    expect(view.contentDOM.querySelectorAll('.cm-md-code-tag')).toHaveLength(6)
  })

  it('shows the real tags while the selection touches the code', () => {
    const view = editor(
      'A <code style="color: red">dep^loy</code> <code>plain</code>',
    )
    expect(view.contentDOM.textContent).toBe(
      'A <code style="color: red">deploy</code> `plain`',
    )
    expect(spans(view, '<code style="color: red">')).toHaveLength(1)
    view.dispatch({ selection: { anchor: 0 } })
    expect(view.contentDOM.textContent).toBe('A `deploy` `plain`')
    // At its edge, the code opens for editing too.
    view.dispatch({ selection: { anchor: 2 } })
    expect(spans(view, '<code style="color: red">')).toHaveLength(1)
  })

  it.each([
    '`<code>a</code>`',
    '<codex>a</codex>',
    '<code>open',
    '\\<code>a</code>',
  ])('leaves %s alone', (doc) => {
    expect(editor(doc).contentDOM.querySelector('.md-code-color')).toBeNull()
  })
})

describe('finding code', () => {
  it('finds the code around the caret, in tables too', () => {
    const at = (doc: string) => {
      const { state } = editor(doc)
      return codeAt(state, state.selection.main.head)
    }
    expect(at('a `b^c` d')).toMatchObject({ text: 'bc', html: false })
    expect(at('a <code>b^</code>')).toMatchObject({ text: 'b', html: true })
    expect(at('| `a\\|^b` |\n| - |')).toMatchObject({
      text: 'a|b',
      inTable: true,
    })
    expect(at('a ^`b`')).toBeNull()
    expect(at('a `b`^')).toBeNull()
    expect(at('![`alt^`](x.png)')).toBeNull()
  })

  it('lists the code the preview shows, in order', () => {
    const { state } = editor(
      '> [!note] `title`\n> `body`\n\n`a` <code>b</code> ![`alt`](x.png)\n\n```\n`fenced`\n```',
    )
    expect(inlineCodes(state).map((code) => code.text)).toEqual([
      'body',
      'a',
      'b',
    ])
  })
})

describe('colouring code', () => {
  it('turns plain code into HTML code', () => {
    expect(colored('Run `dep^loy` now', 'red')).toBe(
      'Run <code style="color: red">deploy</code> now',
    )
  })

  it('changes only the colour of HTML code', () => {
    expect(
      colored('<code class="x" style="font-weight: bold">a^</code>', 'green'),
    ).toBe('<code class="x" style="color: green; font-weight: bold">a</code>')
  })

  it('makes HTML code plain code again', () => {
    expect(colored('<code style="color: red">a`b^</code>', null)).toBe(
      '``a`b``',
    )
    expect(colored('`a^`', null)).toBeNull()
  })

  it('keeps the text through a round trip', () => {
    const doc = '`a<b & c\\*^`'
    const html = colored(doc, 'teal')!
    expect(html).toBe('<code style="color: teal">a&lt;b &amp; c\\\\*</code>')
    expect(colored(html.replace('</code>', '^</code>'), null)).toBe(
      doc.replace('^', ''),
    )
  })

  it('keeps a table cell’s pipes escaped', () => {
    const html = colored('| `a\\|^b` |\n| - |', 'red')!
    expect(html).toBe('| <code style="color: red">a\\|b</code> |\n| - |')
    expect(colored(html.replace('</code>', '^</code>'), null)).toBe(
      '| `a\\|b` |\n| - |',
    )
  })
})

describe('the palette above code', () => {
  /** The palette shown for the caret in `doc`, with its editor. */
  async function palette(doc: string) {
    const view = editor(doc)
    await act(async () => view.focus())
    return { view, toolbar: document.querySelector('[role="toolbar"]') }
  }

  it('shows while the caret is in code and colours it', async () => {
    const { view, toolbar } = await palette('Run `dep^loy` now')
    const red = toolbar!.querySelector<HTMLElement>('[aria-label="Red"]')!
    await act(async () => red.click())
    expect(view.state.doc.toString()).toBe(
      'Run <code style="color: red">deploy</code> now',
    )
    // The caret stays in the text, so the palette does too.
    expect(view.state.selection.main.head).toBe(
      'Run <code style="color: red">dep'.length,
    )
    expect(
      document
        .querySelector('[aria-label="Red"]')
        ?.getAttribute('aria-checked'),
    ).toBe('true')
  })

  it('stays away from text outside code', async () => {
    const { toolbar } = await palette('Run ^`deploy` now')
    expect(toolbar).toBeNull()
  })
})
