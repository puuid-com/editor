import { useDeferredValue, useRef } from 'react'
import type { ComponentProps } from 'react'
import type { FileLocation } from '#/lib/store/files'
import { cn } from '#/lib/utils'
import { Markdown } from '@tanstack/markdown/react'
import type {
  BlockNode,
  InlineNode,
  MarkdownExtension,
} from '@tanstack/markdown'
import type { MarkdownComponents } from '@tanstack/markdown/react'

import { CodeBlock } from './CodeBlock'
import { highlightCode } from './highlight'
import { MermaidDiagram } from './MermaidDiagram'
import {
  EmbeddedNote,
  NoteProvider,
  PreviewImage,
  PreviewLink,
  WikiEmbed,
  WikiLink,
  useNoteEmbed,
} from './note-links'
import {
  WIKI_EMBED_TAG,
  WIKI_LINK_TAG,
  obsidianSyntax,
} from './obsidian-syntax'
import { usePreviewScroll } from './use-preview-scroll'
import { useFileContent } from '#/hooks/use-files'
import { wikilinkText } from '#/lib/obsidian'
import { m } from '#/paraglide/messages'

const DIAGRAM_TAG = 'mermaid-diagram'
const NOTE_EMBED_TAG = 'note-embed'

/**
 * ```mermaid blocks become diagrams instead of highlighted code, and an
 * `![[embed]]` alone on its line a block that can hold a whole note.
 */
const blocks: MarkdownExtension = {
  name: 'blocks',
  transformDocument: (document) => ({
    ...document,
    children: document.children.map(toBlock),
  }),
}

/** The embed a paragraph holds and nothing else, but space. */
function soleEmbed(children: Array<InlineNode>) {
  const nodes = children.filter(
    (child) => child.type !== 'text' || child.value.trim(),
  )
  const [node] = nodes
  return nodes.length === 1 &&
    node.type === 'inlineComponent' &&
    node.tagName === WIKI_EMBED_TAG
    ? node
    : undefined
}

function toBlock(node: BlockNode): BlockNode {
  if (node.type === 'code' && node.lang?.toLowerCase() === 'mermaid') {
    return {
      type: 'component',
      name: 'mermaid',
      tagName: DIAGRAM_TAG,
      attributes: {},
      properties: { code: node.value },
      children: [],
    }
  }
  if (node.type === 'paragraph') {
    const embed = soleEmbed(node.children)
    if (embed)
      return {
        type: 'component',
        name: 'note-embed',
        tagName: NOTE_EMBED_TAG,
        attributes: {},
        properties: embed.properties,
        children: [],
      }
  }
  if (node.type === 'blockquote' || node.type === 'callout')
    return { ...node, children: node.children.map(toBlock) }
  if (node.type === 'list')
    return {
      ...node,
      items: node.items.map((item) => ({
        ...item,
        children: item.children.map(toBlock),
      })),
    }
  return node
}

const EXTENSIONS = [blocks, obsidianSyntax]

/** `![[target]]` on its own line: the note's text, or as inline when it isn't a note. */
function NoteEmbedBlock(link: {
  target?: string
  heading?: string
  alias?: string
}) {
  const embed = useNoteEmbed(link.target ?? '')
  if (!embed)
    return (
      <p>
        <WikiEmbed {...link}>
          {wikilinkText({ ...link, target: link.target ?? '' })}
        </WikiEmbed>
      </p>
    )
  return (
    <EmbeddedNote {...embed} heading={link.heading}>
      {(source) => <MarkdownBody source={source} />}
    </EmbeddedNote>
  )
}

const components = {
  [DIAGRAM_TAG]: MermaidDiagram,
  [NOTE_EMBED_TAG]: NoteEmbedBlock,
  [WIKI_LINK_TAG]: WikiLink,
  [WIKI_EMBED_TAG]: WikiEmbed,
  a: PreviewLink,
  img: PreviewImage,
  pre: CodeBlock,
} satisfies MarkdownComponents

// Typography from the prose plugin, tuned to the app's monochrome tokens.
const PROSE =
  'md-preview prose prose-sm max-w-none break-words prose-neutral dark:prose-invert prose-headings:scroll-mt-4 prose-headings:font-semibold prose-headings:tracking-tight prose-a:underline-offset-2 prose-code:rounded-none prose-code:bg-(--hl-blue)/10 prose-code:px-[0.45em] prose-code:py-[0.2em] prose-code:text-[0.85em] prose-code:font-normal prose-code:text-(--sql-keyword) prose-code:before:content-none prose-code:after:content-none prose-img:rounded-none prose-table:text-xs prose-th:font-medium [&>:first-child]:mt-0 [&>:last-child]:mb-0'

/** The rendered Markdown of a file, following the editor as it is typed. */
export function MarkdownPreview({ fileId }: { fileId: string }) {
  const file = useFileContent(fileId)
  // Rendering waits behind keystrokes, so typing never stalls on a big file.
  const source = useDeferredValue(file?.content ?? '')
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLElement>(null)
  usePreviewScroll(scrollRef, contentRef, fileId)

  return (
    <div
      ref={scrollRef}
      role="region"
      aria-label={m.md_preview()}
      tabIndex={0}
      className="h-full overflow-y-auto px-6 py-5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      <MarkdownDocument
        ref={contentRef}
        source={source}
        location={file?.location}
      />
    </div>
  )
}

/** One renderer for the live preview and PDF: extensions, typography and assets stay identical. */
export function MarkdownDocument({
  source,
  location,
  className,
  ...props
}: ComponentProps<'article'> & {
  source: string
  location?: FileLocation
}) {
  return (
    <article {...props} className={cn(PROSE, className)}>
      <NoteProvider location={location}>
        <MarkdownBody source={source} />
      </NoteProvider>
    </article>
  )
}

function MarkdownBody({ source }: { source: string }) {
  return (
    <Markdown
      components={components}
      extensions={EXTENSIONS}
      highlighter={highlightCode}
    >
      {source}
    </Markdown>
  )
}
