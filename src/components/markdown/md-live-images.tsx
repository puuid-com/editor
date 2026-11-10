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

import { isLive, liveChanged, touched } from './md-live'
import { NoteProvider, PreviewImage, WikiEmbed } from './note-links'
import { fileIdField } from '#/components/editor/extensions'
import { treeChanged } from '#/components/editor/syntax'
import { browserQueryClient } from '#/integrations/tanstack-query/root-provider'
import { isImagePath, parseWikilink } from '#/lib/obsidian'
import { filesCollection } from '#/lib/store/files'

// Live preview's images: `![alt](src)` and `![[image.png|300]]` show the
// image in place of their Markdown, read from the note's folder as the
// preview panel reads it. While the selection touches one, its Markdown
// comes back with the image after it. Kept apart from the rest of live
// preview, which the editor's language setup loads before the folder's files.

/** What an image in the note points at. */
type ImageSource =
  | { kind: 'markdown'; src: string; alt: string }
  | { kind: 'embed'; inner: string }

const roots = new WeakMap<HTMLElement, Root>()

class LiveImage extends WidgetType {
  constructor(readonly source: ImageSource) {
    super()
  }

  eq(other: LiveImage) {
    return JSON.stringify(other.source) === JSON.stringify(this.source)
  }

  toDOM(view: EditorView) {
    const dom = document.createElement('span')
    dom.className = 'cm-md-image'
    // Lines grow once the image loads; `load` doesn't bubble, so catch it on the way down.
    dom.addEventListener('load', () => view.requestMeasure(), true)
    const fileId = view.state.field(fileIdField, false)
    const location = fileId ? filesCollection.get(fileId)?.location : undefined
    const root = createRoot(dom)
    roots.set(dom, root)
    root.render(
      <QueryClientProvider client={browserQueryClient()}>
        <NoteProvider location={location}>{this.image()}</NoteProvider>
      </QueryClientProvider>,
    )
    return dom
  }

  private image() {
    const { source } = this
    if (source.kind === 'markdown')
      return <PreviewImage src={source.src} alt={source.alt} />
    const link = parseWikilink(source.inner)
    return <WikiEmbed {...link}>{link.target}</WikiEmbed>
  }

  destroy(dom: HTMLElement) {
    const root = roots.get(dom)
    // Later, as CodeMirror can get here while React is committing.
    if (root) queueMicrotask(() => root.unmount())
  }

  // A click on the image puts the caret there, which shows its Markdown.
  ignoreEvent() {
    return false
  }
}

/** `![alt](src)`, or null for `![alt][ref]`. */
function markdownImage(state: EditorState, node: SyntaxNode) {
  const url = node.getChild('URL')
  const marks = node.getChildren('LinkMark')
  if (!url || marks.length < 2) return null
  return new LiveImage({
    kind: 'markdown',
    src: state.sliceDoc(url.from, url.to).replace(/^<|>$/g, ''),
    alt: state.sliceDoc(marks[0].to, marks[1].from),
  })
}

/** `![[image.png|300]]`, or null when it embeds anything but an image. */
function embeddedImage(state: EditorState, node: SyntaxNode) {
  if (state.sliceDoc(node.from, node.from + 1) !== '!') return null
  const marks = node.getChildren('WikiLinkMark')
  if (marks.length < 2) return null
  const inner = state.sliceDoc(marks[0].to, marks[1].from)
  if (!isImagePath(parseWikilink(inner).target)) return null
  return new LiveImage({ kind: 'embed', inner })
}

const IMAGES = /!\[\[[^\]\n]*\]\]|!\[[^\]\n]*\]\([^)\n]*\)/g

/** Whether a line holds images and nothing else, but space. */
const imagesOnly = (text: string) => !text.replace(IMAGES, '').trim()

/** A line of images alone, which the Center menu can put in the middle. */
const imageLine = Decoration.line({ class: 'cm-md-image-line' })

function imageDecorations(view: EditorView): DecorationSet {
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
            ? embeddedImage(state, ref.node)
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

const imagePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = imageDecorations(view)
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        treeChanged(update) ||
        liveChanged(update)
      )
        this.decorations = imageDecorations(update.view)
    }
  },
  { decorations: (plugin) => plugin.decorations },
)

/** Shows a Markdown note's images in live preview. */
export const liveImages: Extension = [
  imagePlugin,
  EditorView.baseTheme({
    '.cm-md-image img': {
      display: 'inline-block',
      maxWidth: '100%',
      height: 'auto',
      verticalAlign: 'bottom',
    },
  }),
]
