import { useSelector } from '@tanstack/react-store'
import { Suspense } from 'react'

import { uiStore } from './ui-store'
import { lazyPart } from '#/lib/lazy'

const PasteOffer = lazyPart(() =>
  import('./on-demand').then((mod) => mod.PasteOffer),
)

/**
 * Sits under the tabs of a file whose content was pasted over, offering the
 * type the content reads as. Turning it down keeps the file as it is.
 */
export function PasteBar({ fileId }: { fileId: string }) {
  const choice = useSelector(uiStore, (s) =>
    s.pasteChoice?.fileId === fileId ? s.pasteChoice : null,
  )
  if (!choice) return null
  return (
    <Suspense>
      <PasteOffer fileId={fileId} choice={choice} />
    </Suspense>
  )
}
