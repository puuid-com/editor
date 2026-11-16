import { useSelector } from '@tanstack/react-store'
import { Suspense } from 'react'

import { PanelFrame } from './PanelFrame'
import { editorStore } from '#/components/editor/editor-store'
import { XmlTree } from '#/components/inspector/XmlTree'
import { PinnedFields } from '#/components/pins/PinnedFields'
import { lazyPart } from '#/lib/lazy'
import { m } from '#/paraglide/messages'
import type { PaneEdge } from '#/lib/store/pane-layout'

// Fixed-width files are rare, and their table is a library of its own.
const FlatRecords = lazyPart(() =>
  import('#/components/flat/FlatRecords').then((mod) => mod.FlatRecords),
)

/** Pinned fields and the structure tree of the active document, or the
 * records of a flat file (which has no pins). */
export function SidePanel({ edge }: { edge: PaneEdge }) {
  const fileId = useSelector(editorStore, (s) => s.fileId)
  const flat = useSelector(editorStore, (s) => s.doc.language === 'flat')
  return (
    <PanelFrame
      title={flat ? m.panel_records() : m.panel_structure()}
      edge={edge}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {!flat && <PinnedFields />}
        <div className="min-h-0 flex-1">
          {flat ? (
            <Suspense>
              <FlatRecords key={fileId} />
            </Suspense>
          ) : (
            <XmlTree key={fileId} />
          )}
        </div>
      </div>
    </PanelFrame>
  )
}
