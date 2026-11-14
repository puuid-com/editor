import { syntaxTree } from '@codemirror/language'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
} from '@codemirror/view'
import { QueryClientProvider } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { EditorState, Extension, Range } from '@codemirror/state'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import type { CSSProperties, PointerEvent, ReactNode } from 'react'
import type { Root } from 'react-dom/client'

import { drawnEmbed, isLive, liveChanged, touched } from './md-live'
import { MarkdownDocument } from './MarkdownPreview'
import { NoteProvider, PreviewImage, WikiEmbed } from './note-links'
import { fileIdField } from '#/components/editor/file-id'
import { treeChanged } from '#/components/editor/syntax'
import { browserQueryClient } from '#/integrations/tanstack-query/root-provider'
import { isImagePath, parseWikilink, withImageWidth } from '#/lib/obsidian'
import { filesCollection } from '#/lib/store/files'

// Live preview's embeds: `![alt](src)` and `![[image.png|300]]` show the
// image in place of their Markdown, and `![[note]]` alone on its line the
// note's text, read from the note's folder as the preview panel reads them.
// While the selection touches one, its Markdown comes back: under an image
// alone on its line, so the image stays where it was, else before the embed.
// A click on an image selects its Markdown, and the handle at its corner
// drags its width into the Markdown as Obsidian's `|300`. Kept apart from the rest of live preview, which the editor's
// language setup loads before the folder's files.

/** What an embed in the note points at. */
type EmbedSource =
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'embed'; inner: string }
  | { kind: 'note'; inner: string }

interface Mounted {
  root: Root
  observer?: ResizeObserver
}

const mounted = new WeakMap<HTMLElement, Mounted>()

/**
 * Has the editor measure its lines again, as one grew inside a widget.
 * CodeMirror only does once the content's height changes, which a short
 * note's doesn't, as it fills the editor, so its gutter and selection would
 * stay where the old line heights put them.
 */
function remeasure(view: EditorView) {
  const internal = view as unknown as {
    viewState?: { mustMeasureContent: boolean | 'refresh' }
  }
  if (internal.viewState) internal.viewState.mustMeasureContent = true
  view.requestMeasure()
}

/**
 * Where an embed shows: over its Markdown, above it on a row of its own, or
 * after it.
 */
type Place = 'over' | 'above' | 'after'

class LiveEmbed extends WidgetType {
  constructor(
    readonly source: EmbedSource,
    readonly place: Place = 'over',
    readonly selected = false,
  ) {
    super()
  }

  eq(other: LiveEmbed) {
    return (
      other.place === this.place &&
      other.selected === this.selected &&
      JSON.stringify(other.source) === JSON.stringify(this.source)
    )
  }

  toDOM(view: EditorView) {
    const dom = document.createElement(this.isNote ? 'div' : 'span')
    // Lines grow as images load and notes are read.
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(() => remeasure(view))
    observer?.observe(dom)
    const root = createRoot(dom)
    mounted.set(dom, { root, observer })
    this.draw(dom, view, root)
    return dom
  }

  // The same embed, moved or selected, keeps its DOM, so its image doesn't
  // load again and flash.
  updateDOM(dom: HTMLElement, view: EditorView) {
    const entry = mounted.get(dom)
    if (!entry || dom.classList.contains('cm-md-note-embed') !== this.isNote)
      return false
    this.draw(dom, view, entry.root)
    return true
  }

  private get isNote() {
    return this.source.kind === 'note'
  }

  private draw(dom: HTMLElement, view: EditorView, root: Root) {
    dom.className = this.isNote ? 'cm-md-note-embed' : 'cm-md-image'
    dom.classList.toggle('cm-md-image-above', this.place === 'above')
    dom.classList.toggle('cm-md-image-selected', this.selected)
    // Where `embedAt` finds its Markdown from the widget.
    dom.dataset.at = this.place === 'after' ? 'end' : 'start'
    const fileId = view.state.field(fileIdField, false)
    const location = fileId ? filesCollection.get(fileId)?.location : undefined
    root.render(
      <QueryClientProvider client={browserQueryClient()}>
        {this.source.kind === 'note' ? (
          <MarkdownDocument
            source={`![[${this.source.inner}]]`}
            location={location}
          />
        ) : (
          <NoteProvider location={location}>
            <Resizable onResize={(width) => resize(view, dom, width)}>
              {this.image()}
            </Resizable>
          </NoteProvider>
        )}
      </QueryClientProvider>,
    )
  }

  private image() {
    const { source } = this
    if (source.kind === 'image')
      return <PreviewImage src={source.src} alt={source.alt} />
    const link = parseWikilink(source.inner)
    return <WikiEmbed {...link}>{link.target}</WikiEmbed>
  }

  destroy(dom: HTMLElement) {
    const entry = mounted.get(dom)
    if (!entry) return
    entry.observer?.disconnect()
    // Later, as CodeMirror can get here while React is committing.
    queueMicrotask(() => entry.root.unmount())
  }

  // Links, buttons and the resize handle work on their own; a click anywhere
  // else reaches the editor, which selects an image or puts the caret by a
  // note.
  ignoreEvent(event: Event) {
    return (
      event.target instanceof Element &&
      !!event.target.closest(
        'a, button, input, select, textarea, .cm-md-resize',
      )
    )
  }
}

const MIN_WIDTH = 24

/** An image with a handle at its corner that drags its width. */
function Resizable({
  children,
  onResize,
}: {
  children: ReactNode
  onResize: (width: number) => void
}) {
  const [width, setWidth] = useState<number>()
  const drag = useRef<{
    x: number
    from: number
    width: number
    scale: number
    max: number
  }>(null)

  const start = (event: PointerEvent<HTMLElement>) => {
    const img = event.currentTarget.parentElement?.querySelector('img')
    if (event.button !== 0 || !img) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const line = img.closest<HTMLElement>('.cm-line')
    const from = img.getBoundingClientRect().width
    drag.current = {
      x: event.clientX,
      from,
      width: Math.round(from),
      // A centered image grows on both sides, so twice as fast keeps its
      // corner under the pointer.
      scale: line && getComputedStyle(line).textAlign === 'center' ? 2 : 1,
      max: line?.clientWidth || Infinity,
    }
    setWidth(drag.current.width)
  }

  const move = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current
    if (!current) return
    const next = current.from + (event.clientX - current.x) * current.scale
    current.width = Math.round(Math.min(current.max, Math.max(MIN_WIDTH, next)))
    setWidth(current.width)
  }

  const end = (commit: boolean) => {
    const current = drag.current
    if (!current) return
    drag.current = null
    setWidth(undefined)
    if (commit) onResize(current.width)
  }

  return (
    <span
      className="cm-md-resizable"
      data-resizing={width === undefined ? undefined : ''}
      style={
        width === undefined
          ? undefined
          : ({ '--md-image-width': `${width}px` } as CSSProperties)
      }
    >
      {children}
      <span
        className="cm-md-resize"
        aria-hidden
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={() => end(true)}
        onPointerCancel={() => end(false)}
      />
    </span>
  )
}

/** The image or embed node the widget `dom` draws, found from where it sits. */
function embedAt(view: EditorView, dom: HTMLElement) {
  const pos = view.posAtDOM(dom)
  const atEnd = dom.dataset.at === 'end'
  const tree = syntaxTree(view.state)
  for (
    let node: SyntaxNode | null = tree.resolveInner(pos, atEnd ? -1 : 1);
    node;
    node = node.parent
  )
    if (node.name === 'Image' || node.name === 'WikiLink')
      return (atEnd ? node.to : node.from) === pos ? node : null
  return null
}

/**
 * The change that makes the image at `node` `width` pixels wide: an embed's
 * `|300`, a Markdown image's `![alt|300](src)`, with `\|` in a table.
 */
export function widthChange(
  state: EditorState,
  node: SyntaxNode,
  width: number,
) {
  let table = false
  for (let up = node.parent; up && !table; up = up.parent)
    table = up.name === 'Table'
  const pipe = table ? '\\|' : '|'
  if (node.name === 'WikiLink') {
    const from = node.from + 3
    const to = node.to - 2
    const inner = state.sliceDoc(from, to)
    const bar = /\\?\|/.exec(inner)
    const sep = bar?.[0] ?? pipe
    const alias = bar ? inner.slice(bar.index + sep.length) : ''
    return {
      from: bar ? from + bar.index : to,
      to,
      insert: sep + withImageWidth(alias, width, { pipe: sep }),
    }
  }
  const marks = node.getChildren('LinkMark')
  if (marks.length < 2) return null
  const from = marks[0].to
  const to = marks[1].from
  return {
    from,
    to,
    insert: withImageWidth(state.sliceDoc(from, to), width, {
      markdown: true,
      pipe,
    }),
  }
}

function resize(view: EditorView, dom: HTMLElement, width: number) {
  const node = view.state.readOnly ? null : embedAt(view, dom)
  const changes = node && widthChange(view.state, node, width)
  if (changes) view.dispatch({ changes, userEvent: 'input.resize' })
}

/** Selects the Markdown of the image clicked, which shows it under the image. */
function selectImage(event: MouseEvent, view: EditorView) {
  const target = event.target
  if (
    event.button !== 0 ||
    event.shiftKey ||
    event.altKey ||
    event.metaKey ||
    event.ctrlKey ||
    !(target instanceof Element)
  )
    return false
  const dom = target.closest<HTMLElement>('.cm-md-image')
  const node = dom && embedAt(view, dom)
  if (!node) return false
  event.preventDefault()
  view.dispatch({ selection: { anchor: node.from, head: node.to } })
  view.focus()
  return true
}

/** `![alt](src)`, or null for `![alt][ref]`. */
function markdownImage(
  state: EditorState,
  node: SyntaxNode,
): EmbedSource | null {
  const url = node.getChild('URL')
  const marks = node.getChildren('LinkMark')
  if (!url || marks.length < 2) return null
  return {
    kind: 'image' as const,
    src: state.sliceDoc(url.from, url.to).replace(/^<|>$/g, ''),
    alt: state.sliceDoc(marks[0].to, marks[1].from),
  }
}

/** `![[image.png|300]]`, `![[note]]` alone on its line, or null for another wikilink. */
function wikiEmbed(state: EditorState, node: SyntaxNode): EmbedSource | null {
  if (!drawnEmbed(state.doc, node.from, node.to)) return null
  const inner = state.sliceDoc(node.from + 3, node.to - 2)
  return {
    kind: isImagePath(parseWikilink(inner).target)
      ? ('embed' as const)
      : ('note' as const),
    inner,
  }
}

const IMAGES = /!\[\[([^\]\n]*)\]\]|!\[[^\]\n]*\]\([^)\n]*\)/g

/** Whether a line holds images and nothing else, but space. */
const imagesOnly = (text: string) =>
  !text
    .replace(IMAGES, (image, inner?: string) =>
      inner === undefined || isImagePath(parseWikilink(inner).target)
        ? ''
        : image,
    )
    .trim()

/** A line of images alone, which the Center menu can put in the middle. */
const imageLine = Decoration.line({ class: 'cm-md-image-line' })

function embedDecorations(view: EditorView): DecorationSet {
  const { state } = view
  if (!isLive(state)) return Decoration.none
  const { doc } = state
  const ranges: Array<Range<Decoration>> = []
  const lines = new Set<number>()
  const { from, to } = view.viewport
  syntaxTree(state).iterate({
    from,
    to,
    enter: (ref) => {
      // Code shows as written.
      if (/Code|HTMLBlock|CommentBlock/.test(ref.name)) return false
      const source =
        ref.name === 'Image'
          ? markdownImage(state, ref.node)
          : ref.name === 'WikiLink'
            ? wikiEmbed(state, ref.node)
            : null
      if (!source) return undefined
      const { from: start, to: end } = ref
      const line = doc.lineAt(start)
      const alone = imagesOnly(line.text)
      const { main } = state.selection
      const selected =
        source.kind !== 'note' && main.from === start && main.to === end
      if (!touched(state, start, end))
        ranges.push(
          Decoration.replace({ widget: new LiveEmbed(source) }).range(
            start,
            end,
          ),
        )
      // An image alone on its line keeps its place, its Markdown under it.
      else if (alone)
        ranges.push(
          Decoration.widget({
            widget: new LiveEmbed(source, 'above', selected),
            side: -1,
          }).range(start),
        )
      else
        ranges.push(
          Decoration.widget({
            widget: new LiveEmbed(source, 'after', selected),
            side: 1,
          }).range(end),
        )
      if (!lines.has(line.from) && alone) {
        lines.add(line.from)
        ranges.push(imageLine.range(line.from))
      }
      return false
    },
  })
  return Decoration.set(ranges, true)
}

const embedPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = embedDecorations(view)
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        treeChanged(update) ||
        liveChanged(update)
      )
        this.decorations = embedDecorations(update.view)
    }
  },
  { decorations: (plugin) => plugin.decorations },
)

/** Shows a Markdown note's images and embedded notes in live preview. */
export const liveEmbeds: Extension = [
  embedPlugin,
  EditorView.domEventHandlers({ mousedown: selectImage }),
  EditorView.baseTheme({
    '.cm-md-image-above': { display: 'block' },
    '.cm-md-resizable': {
      position: 'relative',
      display: 'inline-block',
      maxWidth: '100%',
      verticalAlign: 'bottom',
    },
    '.cm-md-image img': {
      display: 'inline-block',
      maxWidth: '100%',
      height: 'auto',
      verticalAlign: 'bottom',
    },
    '.cm-md-resizable[data-resizing] img': {
      width: 'var(--md-image-width) !important',
      height: 'auto !important',
    },
    '.cm-md-image-selected img, .cm-md-resizable[data-resizing] img': {
      outline: '2px solid var(--ring)',
      outlineOffset: '2px',
    },
    '.cm-md-resize': {
      position: 'absolute',
      right: '-5px',
      bottom: '-5px',
      width: '10px',
      height: '10px',
      border: '1px solid var(--foreground)',
      background: 'var(--background)',
      cursor: 'nwse-resize',
      touchAction: 'none',
      visibility: 'hidden',
    },
    [`.cm-md-image:hover .cm-md-resize, .cm-md-image-selected .cm-md-resize,
      .cm-md-resizable[data-resizing] .cm-md-resize`]: {
      visibility: 'visible',
    },
    // Nothing to resize: an embed that isn't found, or a read-only editor.
    '.cm-md-resizable:not(:has(img)) .cm-md-resize, .cm-content[contenteditable=false] .cm-md-resize':
      { display: 'none' },
    '.cm-md-note-embed': {
      display: 'block',
      whiteSpace: 'normal',
      padding: '2px 0',
    },
  }),
]
