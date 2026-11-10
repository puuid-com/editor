import { syntaxTree } from '@codemirror/language'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
} from '@codemirror/view'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import type { EditorState, Extension, Range } from '@codemirror/state'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import type { Root } from 'react-dom/client'

import { drawnEmbed, isLive, liveChanged, touched } from './md-live'
import { MarkdownDocument } from './MarkdownPreview'
import { NoteProvider, PreviewImage, WikiEmbed } from './note-links'
import { fileIdField } from '#/components/editor/extensions'
import { treeChanged } from '#/components/editor/syntax'
import { browserQueryClient } from '#/integrations/tanstack-query/root-provider'
import { isImagePath, parseWikilink } from '#/lib/obsidian'
import { filesCollection } from '#/lib/store/files'

// Live preview's embeds: `![alt](src)` and `![[image.png|300]]` show the
// image in place of their Markdown, and `![[note]]` alone on its line the
// note's text, read from the note's folder as the preview panel reads them.
// While the selection touches one, its Markdown comes back with the embed
// after it. Kept apart from the rest of live preview, which the editor's
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

class LiveEmbed extends WidgetType {
  constructor(readonly source: EmbedSource) {
    super()
  }

  eq(other: LiveEmbed) {
    return JSON.stringify(other.source) === JSON.stringify(this.source)
  }

  toDOM(view: EditorView) {
    const note = this.source.kind === 'note'
    const dom = document.createElement(note ? 'div' : 'span')
    dom.className = note ? 'cm-md-note-embed' : 'cm-md-image'
    // Lines grow as images load and notes are read.
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(() => view.requestMeasure())
    observer?.observe(dom)
    const fileId = view.state.field(fileIdField, false)
    const location = fileId ? filesCollection.get(fileId)?.location : undefined
    const root = createRoot(dom)
    mounted.set(dom, { root, observer })
    root.render(
      <QueryClientProvider client={browserQueryClient()}>
        {this.source.kind === 'note' ? (
          <MarkdownDocument
            source={`![[${this.source.inner}]]`}
            location={location}
          />
        ) : (
          <NoteProvider location={location}>{this.image()}</NoteProvider>
        )}
      </QueryClientProvider>,
    )
    return dom
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

  // Links and buttons in an embedded note work; a click anywhere else puts
  // the caret there, which shows the embed's Markdown.
  ignoreEvent(event: Event) {
    return (
      event.target instanceof Element &&
      !!event.target.closest('a, button, input, select, textarea')
    )
  }
}

/** `![alt](src)`, or null for `![alt][ref]`. */
function markdownImage(state: EditorState, node: SyntaxNode) {
  const url = node.getChild('URL')
  const marks = node.getChildren('LinkMark')
  if (!url || marks.length < 2) return null
  return new LiveEmbed({
    kind: 'image',
    src: state.sliceDoc(url.from, url.to).replace(/^<|>$/g, ''),
    alt: state.sliceDoc(marks[0].to, marks[1].from),
  })
}

/** `![[image.png|300]]`, `![[note]]` alone on its line, or null for another wikilink. */
function wikiEmbed(state: EditorState, node: SyntaxNode) {
  if (!drawnEmbed(state.doc, node.from, node.to)) return null
  const inner = state.sliceDoc(node.from + 3, node.to - 2)
  return new LiveEmbed({
    kind: isImagePath(parseWikilink(inner).target) ? 'embed' : 'note',
    inner,
  })
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
      const widget =
        ref.name === 'Image'
          ? markdownImage(state, ref.node)
          : ref.name === 'WikiLink'
            ? wikiEmbed(state, ref.node)
            : null
      if (!widget) return undefined
      const { from: start, to: end } = ref
      if (touched(state, start, end))
        ranges.push(Decoration.widget({ widget, side: 1 }).range(end))
      else ranges.push(Decoration.replace({ widget }).range(start, end))
      const line = doc.lineAt(start)
      if (!lines.has(line.from) && imagesOnly(line.text)) {
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
  EditorView.baseTheme({
    '.cm-md-image img': {
      display: 'inline-block',
      maxWidth: '100%',
      height: 'auto',
      verticalAlign: 'bottom',
    },
    '.cm-md-note-embed': {
      display: 'block',
      whiteSpace: 'normal',
      padding: '2px 0',
    },
  }),
]
