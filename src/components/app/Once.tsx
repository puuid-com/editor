import { useState } from 'react'

/**
 * Mounts what it holds the first time it is `shown`, and leaves it mounted
 * from then on, so a dialog closes with its animation and keeps its state.
 * For parts that load when first shown: see `lazyPart`.
 */
export function Once({
  shown,
  children,
}: {
  shown: boolean
  children: React.ReactNode
}) {
  const [mounted, setMounted] = useState(shown)
  if (shown && !mounted) setMounted(true)
  return mounted ? children : null
}
