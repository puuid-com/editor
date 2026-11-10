import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { markdownSupport } from './md-language'
import { setMarkdownLive } from './md-live'
import { liveEmbeds, widthChange } from './md-live-embeds'

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
      extensions: [markdownSupport(), liveEmbeds],
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

/** The line of the first image, with `[image]` where the image shows. */
function drawn(view: EditorView) {
  const widget = view.contentDOM.querySelector('.cm-md-image')!
  const line = widget.closest('.cm-line')!.cloneNode(true) as HTMLElement
  line.querySelector('.cm-md-image')!.replaceWith('[image]')
  return line.textContent
}

const image = (view: EditorView) =>
  view.contentDOM.querySelector<HTMLImageElement>('.cm-md-image img')

describe('live preview embeds', () => {
  it('shows an image in place of its Markdown', async () => {
    const view = editor('Look ![A cat](https://x.dev/cat.png) here')
    expect(shown(view)).toEqual(['Look  here'])
    await vi.waitFor(() => {
      expect(image(view)?.getAttribute('src')).toBe('https://x.dev/cat.png')
      expect(image(view)?.alt).toBe('A cat')
    })
  })

  it('keeps an image alone on its line above its Markdown while the caret touches it', async () => {
    const view = editor('![A cat](https://x.dev/cat.png^)')
    expect(shown(view)).toEqual(['![A cat](https://x.dev/cat.png)'])
    const widget = view.contentDOM.querySelector('.cm-md-image')
    expect(widget?.classList.contains('cm-md-image-above')).toBe(true)
    expect(drawn(view)).toBe('[image]![A cat](https://x.dev/cat.png)')
    await vi.waitFor(() => expect(image(view)).not.toBeNull())
  })

  it('keeps an image in text after its Markdown while the caret touches it', () => {
    const view = editor('Look ![A cat](https://x.dev/cat.png^) here')
    const widget = view.contentDOM.querySelector('.cm-md-image')
    expect(widget?.classList.contains('cm-md-image-above')).toBe(false)
    expect(drawn(view)).toBe('Look ![A cat](https://x.dev/cat.png)[image] here')
  })

  it("selects an image's Markdown when it is clicked", () => {
    const view = editor('Intro\n![A cat](https://x.dev/cat.png)')
    const widget = view.contentDOM.querySelector('.cm-md-image')!
    widget.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, button: 0 }),
    )
    const { from, to } = view.state.selection.main
    expect(view.state.sliceDoc(from, to)).toBe(
      '![A cat](https://x.dev/cat.png)',
    )
    const selected = view.contentDOM.querySelector('.cm-md-image')
    expect(selected?.classList.contains('cm-md-image-selected')).toBe(true)
    expect(selected?.classList.contains('cm-md-image-above')).toBe(true)
  })

  it('leaves code and notes embedded in text as they are', () => {
    const view = editor('`![a](a.png)` ![[note]]')
    expect(view.contentDOM.querySelector('.cm-md-image')).toBeNull()
    expect(view.contentDOM.querySelector('.cm-md-note-embed')).toBeNull()
  })

  it('shows a note embedded alone on its line', async () => {
    const view = editor('Intro\n![[note#Part]]')
    const embed = () =>
      view.contentDOM.querySelector<HTMLElement>('.cm-md-note-embed')
    expect(embed()).not.toBeNull()
    expect(shown(view)).toEqual(['Intro'])
    // With no folder to read it from, it shows as a link to nothing.
    await vi.waitFor(() => expect(embed()?.textContent).toBe('note > Part'))
  })

  it('shows nothing when live preview is off', () => {
    const view = editor('![a](https://x.dev/a.png)')
    view.dispatch({ effects: setMarkdownLive.of(false) })
    expect(view.contentDOM.querySelector('.cm-md-image')).toBeNull()
  })

  it('marks lines of images alone, for centering', () => {
    const view = editor(
      '![a](a.png) ![[b.png|200]]\nText ![c](c.png)\n![[note]]',
    )
    const marked = [...view.contentDOM.querySelectorAll('.cm-line')].map(
      (line) => line.classList.contains('cm-md-image-line'),
    )
    expect(marked).toEqual([true, false, false, false])
  })

  it('writes a dragged width into the Markdown', () => {
    const resized = (doc: string, width: number) => {
      const state = EditorState.create({
        doc,
        extensions: [markdownSupport()],
      })
      ensureSyntaxTree(state, doc.length, 5000)
      let changed = doc
      syntaxTree(state).iterate({
        enter: (ref) => {
          if (ref.name !== 'Image' && ref.name !== 'WikiLink') return undefined
          const change = widthChange(state, ref.node, width)
          if (change)
            changed = state.update({ changes: change }).state.doc.toString()
          return false
        },
      })
      return changed
    }
    expect(resized('![[cat.png]]', 300)).toBe('![[cat.png|300]]')
    expect(resized('![[cat.png|200x100]]', 300)).toBe('![[cat.png|300]]')
    expect(resized('![[cat.png|A cat|200]]', 300)).toBe(
      '![[cat.png|A cat|300]]',
    )
    expect(resized('![A cat](cat.png)', 300)).toBe('![A cat|300](cat.png)')
    expect(resized('![](cat.png)', 300)).toBe('![|300](cat.png)')
    expect(resized('![A cat|200](cat.png)', 300)).toBe('![A cat|300](cat.png)')
    expect(resized('| a |\n| - |\n| ![[cat.png]] |', 80)).toBe(
      '| a |\n| - |\n| ![[cat.png\\|80]] |',
    )
    expect(resized('| a |\n| - |\n| ![x](cat.png) |', 80)).toBe(
      '| a |\n| - |\n| ![x\\|80](cat.png) |',
    )
  })
})
