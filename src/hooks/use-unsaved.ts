import { useSelector } from '@tanstack/react-store'

import { unsavedStore } from '#/lib/store/unsaved'

/** Whether a tab linked to a file on disk has edits not written there yet. */
export function useUnsaved(fileId: string) {
  return useSelector(unsavedStore(), (ids) => ids.has(fileId))
}
