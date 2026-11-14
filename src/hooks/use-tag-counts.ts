import { useSelector } from '@tanstack/react-store'
import { useMemo } from 'react'

import { editorStore } from '#/components/editor/editor-store'
import { localName } from '#/lib/names'
import { hasName, isElement } from '#/lib/xml/model'
import type { XmlNode } from '#/lib/xml/model'

const NO_COUNTS: ReadonlyMap<string, number> = new Map()

/**
 * Local tag name (no prefix) → number of elements with it in the active
 * document. Counted after each parse, unless `enabled` is false, when there
 * is nothing that shows them.
 */
export function useTagCounts(enabled = true): ReadonlyMap<string, number> {
  const doc = useSelector(editorStore, (s) => s.doc)
  return useMemo(() => {
    if (!enabled) return NO_COUNTS
    const counts = new Map<string, number>()
    const visit = (nodes: Array<XmlNode>) => {
      for (const node of nodes) {
        if (!isElement(node)) continue
        if (hasName(node)) {
          const name = localName(node.name)
          counts.set(name, (counts.get(name) ?? 0) + 1)
        }
        visit(node.children)
      }
    }
    visit(doc.nodes)
    return counts
  }, [doc, enabled])
}
