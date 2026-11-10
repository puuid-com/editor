import { useSelector } from '@tanstack/react-store'
import { useState } from 'react'

import { deleteFiles } from './files'
import { notify } from './notice-store'
import { askDelete, uiStore } from './ui-store'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import { ARCHIVE_LIMIT, filesCollection } from '#/lib/store/files'
import { m } from '#/paraglide/messages'

/** Confirms moving browser files to the archive. */
export function DeleteDialog({ openIds }: { openIds: Array<string> }) {
  const deleteIds = useSelector(uiStore, (s) => s.deleteIds)
  const files = (deleteIds ?? []).flatMap((id) => {
    const file = filesCollection.get(id)
    return file?.deletedAt === null ? [file] : []
  })
  const [deleting, setDeleting] = useState(false)

  const confirm = () => {
    if (!files.length || deleting) return
    setDeleting(true)
    return deleteFiles(
      files.map((file) => file.id),
      openIds,
    )
      .then(() => askDelete(null))
      .catch(() => notify.error(m.archive_delete_failed()))
      .finally(() => setDeleting(false))
  }

  const many = files.length > 1

  return (
    <AlertDialog
      open={files.length > 0}
      onOpenChange={(open) => {
        if (!open && !deleting) askDelete(null)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {many
              ? m.delete_many_title({ count: files.length })
              : m.delete_title({ name: files[0]?.name ?? '' })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {files.length > ARCHIVE_LIMIT
              ? m.delete_many_overflow({ limit: ARCHIVE_LIMIT })
              : m.delete_description({ limit: ARCHIVE_LIMIT })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>
            {m.cancel()}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleting}
            onClick={(event) => {
              event.preventDefault()
              void confirm()
            }}
          >
            {m.delete_confirm()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
