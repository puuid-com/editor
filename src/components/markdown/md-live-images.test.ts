import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { markdownSupport } from './md-language'
import { setMarkdownLive } from './md-live'
import { liveImages } from './md-live-images'

const views: Array<EditorView> = []

afterEach(() => {
  views.splice(0).forEach((view) => view.destroy())
  document.body.innerHTML = ''
})

/** A live editor on `doc`, with `^` marking the caret, else on a last line. */
function editor(doc: string) {
  const text = doc.replace('^', '')
  const caret = doc.includes('^') ? doc.indexOf('^') : text.length + 1
  const view = new EditorView({
    state: EditorState.create({
      doc: doc.includes('^') ? text : `${text}\n`,
      selection: { anchor: caret },
      extensions: [markdownSupport(), liveImages],
    }),
    parent: document.body,
  })
  ensureSyntaxTree(view.state, view.state.doc.length, 5000)
  view.dispatch({ effects: setMarkdownLive.of(true) })
  views.push(view)
  return view
}

const shown = (view: EditorView) =>
  [...view.contentDOM.querySelectorAll('.cm-line')]
    .map((line) => line.textContent)
    .filter(Boolean)

const image = (view: EditorView) =>
  view.contentDOM.querySelector<HTMLImageElement>('.cm-md-image img')

describe('live preview images', () => {
  it('shows an image in place of its Markdown', async () => {
    const view = editor('Look ![A cat](https://x.dev/cat.png) here')
    expect(shown(view)).toEqual(['Look  here'])
    await vi.waitFor(() => {
      expect(image(view)?.getAttribute('src')).toBe('https://x.dev/cat.png')
      expect(image(view)?.alt).toBe('A cat')
    })
  })

  it('keeps the image after its Markdown while the caret touches it', async () => {
    const view = editor('![A cat](https://x.dev/cat.png^)')
    expect(shown(view)).toEqual(['![A cat](https://x.dev/cat.png)'])
    await vi.waitFor(() => expect(image(view)).not.toBeNull())
  })

  it('leaves code and note embeds as they are', () => {
    const view = editor('`![a](a.png)` ![[note]]')
    expect(view.contentDOM.querySelector('.cm-md-image')).toBeNull()
  })

  it('shows nothing when live preview is off', () => {
    const view = editor('![a](https://x.dev/a.png)')
    view.dispatch({ effects: setMarkdownLive.of(false) })
    expect(view.contentDOM.querySelector('.cm-md-image')).toBeNull()
  })

  it('marks lines of images alone, for centering', () => {
    const view = editor('![a](a.png) ![[b.png|200]]\nText ![c](c.png)')
    const marked = [...view.contentDOM.querySelectorAll('.cm-line')].map(
      (line) => line.classList.contains('cm-md-image-line'),
    )
    expect(marked).toEqual([true, false, false])
  })
})
