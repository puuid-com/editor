import { useSyncExternalStore } from 'react'

import { canOpenFolders } from '#/lib/store/disk'

const never = () => () => {}

/** Whether this browser can open a folder from disk; false on the server. */
export function useCanOpenFolders() {
  return useSyncExternalStore(never, canOpenFolders, () => false)
}
