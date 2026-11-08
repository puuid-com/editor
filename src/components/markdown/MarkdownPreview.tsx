import { useDeferredValue, useRef } from 'react'
import { Markdown } from '@tanstack/markdown/react'
import type { BlockNode, MarkdownExtension } from '@tanstack/markdown'
import type { MarkdownComponents } from '@tanstack/markdown/react'

import { CodeBlock } from './CodeBlock'
import { highlightCode } from './highlight'
import { MermaidDiagram } from './MermaidDiagram'
import {
  NoteProvider,
  PreviewImage,
  PreviewLink,
  WikiEmbed,
  WikiLink,
} from './note-links'
import {
  WIKI_EMBED_TAG,
  WIKI_LINK_TAG,
  obsidianSyntax,
} from './obsidian-syntax'
import { usePreviewScroll } from './use-preview-scroll'
import { useFileContent } from '#/hooks/use-files'
import { m } from '#/paraglide/messages'

const DIAGRAM_TAG = 'mermaid-diagram'

/** ```mermaid blocks become diagrams instead of highlighted code. */
const diagrams: MarkdownExtension = {
  name: 'mermaid',
  transformDocument: (document) => ({
    ...document,
    children: document.children.map(toDiagram),
  }),
}

function toDiagram(node: BlockNode): BlockNode {
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
  if (node.type === 'blockquote')
    return { ...node, children: node.children.map(toDiagram) }
  if (node.type === 'list')
    return {
      ...node,
      items: node.items.map((item) => ({
        ...item,
        children: item.children.map(toDiagram),
      })),
    }
  return node
}

const EXTENSIONS = [diagrams, obsidianSyntax]

const components = {
  [DIAGRAM_TAG]: MermaidDiagram,
  [WIKI_LINK_TAG]: WikiLink,
  [WIKI_EMBED_TAG]: WikiEmbed,
  a: PreviewLink,
  img: PreviewImage,
  pre: CodeBlock,
} satisfies MarkdownComponents

// Typography from the prose plugin, tuned to the app's monochrome tokens.
const PROSE =
  'md-preview prose prose-sm max-w-none break-words prose-neutral dark:prose-invert prose-headings:scroll-mt-4 prose-headings:font-semibold prose-headings:tracking-tight prose-a:underline-offset-2 prose-code:rounded-sm prose-code:bg-muted prose-code:px-[0.3em] prose-code:py-[0.15em] prose-code:text-[0.875em] prose-code:font-normal prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none prose-img:rounded-md prose-table:text-xs prose-th:font-medium [&>:first-child]:mt-0 [&>:last-child]:mb-0'

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
      <article ref={contentRef} className={PROSE}>
        <NoteProvider location={file?.location}>
          <Markdown
            components={components}
            extensions={EXTENSIONS}
            highlighter={highlightCode}
          >
            {source}
          </Markdown>
        </NoteProvider>
      </article>
    </div>
  )
}
