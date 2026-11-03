import { useSelector } from '@tanstack/react-store'
import { useState } from 'react'

import { replaceWorkspace } from './backup'
import { setRestorePreview, uiStore } from './ui-store'
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
import { backupCounts } from '#/lib/store/backup'
import { m } from '#/paraglide/messages'

/** Lists what a backup holds before it replaces the workspace. */
export function RestoreDialog() {
  const preview = useSelector(uiStore, (s) => s.restorePreview)
  const backup = preview?.backup
  const [restoring, setRestoring] = useState(false)
  const counts = backup && backupCounts(backup)
  const rows =
    counts &&
    ([
      [m.restore_count_open(), counts.open],
      [m.restore_count_archived(), counts.archived],
      [m.restore_count_profiles(), counts.profiles],
      [m.restore_count_highlights(), counts.highlights],
      [m.restore_count_pins(), counts.pins],
      [m.restore_count_defaults(), counts.defaults],
      [m.restore_count_variables(), counts.variables],
    ] as const)

  const confirm = async () => {
    if (!backup || restoring) return
    setRestoring(true)
    // Reports its own failure, so the dialog always closes afterwards.
    await replaceWorkspace(backup)
    setRestoring(false)
    setRestorePreview(null)
  }

  return (
    <AlertDialog
      open={!!backup}
      onOpenChange={(open) => {
        if (!open && !restoring) setRestorePreview(null)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{m.restore_title()}</AlertDialogTitle>
          <AlertDialogDescription>
            {m.restore_description({ date: preview?.date ?? '' })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <dl className="-mx-1 flex flex-col border-y py-1 text-xs">
          {rows?.map(([label, count]) => (
            <div key={label} className="flex items-center gap-3 px-1 py-1.5">
              <dt className="min-w-0 flex-1 truncate">{label}</dt>
              <dd className="shrink-0 text-muted-foreground tabular-nums">
                {count}
              </dd>
            </div>
          ))}
        </dl>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={restoring}>
            {m.cancel()}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={restoring}
            onClick={(event) => {
              event.preventDefault()
              void confirm()
            }}
          >
            {m.restore_confirm()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
