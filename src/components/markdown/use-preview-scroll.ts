import { useEffect } from 'react'
import { ensureSyntaxTree } from '@codemirror/language'

import { getView } from '#/components/editor/editor-store'
import type { EditorView } from '@codemirror/view'

// Keeps the preview on the part of the document the editor shows. Headings
// are the anchors: the nth heading in the source lines up with the nth in
// the preview, and positions between two are interpolated. If they don't
// pair up (the preview is still catching up), the whole height is one span.

const HEADING = /^(ATX|Setext)Heading/
const PARSE_BUDGET_MS = 20

type Anchor = [editor: number, preview: number]

export function usePreviewScroll(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  contentRef: React.RefObject<HTMLElement | null>,
  fileId: string,
) {
  useEffect(() => {
    const preview = scrollRef.current
    const content = contentRef.current
    const view = getView()
    if (!preview || !content || !view) return
    const editor = view.scrollDOM

    const follow = () => {
      const editorMax = editor.scrollHeight - editor.clientHeight
      const previewMax = preview.scrollHeight - preview.clientHeight
      if (previewMax <= 0) return
      if (editorMax <= 0) {
        preview.scrollTop = 0
        return
      }
      const anchors = headingAnchors(view, preview, content, editorMax)
      preview.scrollTop = interpolate(
        [[0, 0], ...anchors, [editorMax, previewMax]],
        editor.scrollTop,
      )
    }

    const controller = new AbortController()
    editor.addEventListener('scroll', follow, {
      passive: true,
      signal: controller.signal,
    })
    // Typing, a diagram finishing or a resize moves the preview's content.
    const observer = new ResizeObserver(follow)
    observer.observe(content)
    follow()
    return () => {
      controller.abort()
      observer.disconnect()
    }
  }, [scrollRef, contentRef, fileId])
}

function headingAnchors(
  view: EditorView,
  preview: HTMLElement,
  content: HTMLElement,
  editorMax: number,
): Array<Anchor> {
  const tree = ensureSyntaxTree(
    view.state,
    view.state.doc.length,
    PARSE_BUDGET_MS,
  )
  if (!tree) return []
  const sources: Array<number> = []
  tree.iterate({
    enter: (node) => {
      if (HEADING.test(node.name)) {
        sources.push(node.from)
        return false
      }
    },
  })
  const headings = content.querySelectorAll('h1, h2, h3, h4, h5, h6')
  if (headings.length !== sources.length) return []
  // Document y of the editor's text at its top edge.
  const editorTop =
    view.documentTop -
    view.scrollDOM.getBoundingClientRect().top +
    view.scrollDOM.scrollTop
  const previewTop = preview.getBoundingClientRect().top - preview.scrollTop
  const previewMax = preview.scrollHeight - preview.clientHeight
  const anchors: Array<Anchor> = []
  sources.forEach((from, index) => {
    const e = view.lineBlockAt(from).top + editorTop
    const p = headings[index].getBoundingClientRect().top - previewTop
    // Anchors past where either side can scroll would bend the end.
    if (e > 0 && e < editorMax && p > 0 && p < previewMax) anchors.push([e, p])
  })
  return anchors
}

/** Where `y` on the editor's side falls on the preview's, between anchors. */
function interpolate(anchors: Array<Anchor>, y: number) {
  for (let i = 1; i < anchors.length; i++) {
    const [e0, p0] = anchors[i - 1]
    const [e1, p1] = anchors[i]
    if (y > e1 && i < anchors.length - 1) continue
    if (e1 <= e0) return p1
    return p0 + ((Math.min(y, e1) - e0) / (e1 - e0)) * (p1 - p0)
  }
  return 0
}
