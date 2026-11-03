import { useSelector } from '@tanstack/react-store'
import { useState } from 'react'

import { closeTabs } from './files'
import { notify } from './notice-store'
import { askClose, uiStore } from './ui-store'
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

export function CloseDialog({ openIds }: { openIds: Array<string> }) {
  const closeIds = useSelector(uiStore, (s) => s.closeIds)
  const files = (closeIds ?? []).flatMap((id) => {
    const file = filesCollection.get(id)
    return file?.deletedAt === null ? [file] : []
  })
  const [closing, setClosing] = useState(false)

  const confirm = async () => {
    if (!files.length || closing) return
    setClosing(true)
    await closeTabs(
      files.map((file) => file.id),
      openIds,
    ).then(
      () => askClose(null),
      () => notify.error(m.archive_delete_failed()),
    )
    setClosing(false)
  }

  const many = files.length > 1

  return (
    <AlertDialog
      open={files.length > 0}
      onOpenChange={(open) => {
        if (!open && !closing) askClose(null)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {many
              ? m.close_many_title({ count: files.length })
              : m.close_title({ name: files[0]?.name ?? '' })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {files.length > ARCHIVE_LIMIT
              ? m.close_many_overflow({ limit: ARCHIVE_LIMIT })
              : many
                ? m.close_many_description()
                : m.close_description()}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={closing}>{m.cancel()}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={closing}
            onClick={(event) => {
              event.preventDefault()
              void confirm()
            }}
          >
            {m.close_confirm()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
