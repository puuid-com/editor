import { useSelector } from '@tanstack/react-store'

import { setDefaultsPreview, setVarsPreview, uiStore } from './ui-store'
import {
  commitDefaultsActive,
  commitVarsPreview,
} from '#/components/editor/actions'
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
import { mod } from '#/lib/platform'
import { m } from '#/paraglide/messages'

// Confirmations that list what an action would write into the active file.

/** Lists the defaults that would change the active file before writing them. */
export function DefaultsConfirmDialog() {
  const preview = useSelector(uiStore, (s) => s.defaultsPreview)

  return (
    <ChangesDialog
      open={!!preview}
      onClose={() => setDefaultsPreview(null)}
      title={m.defaults_confirm_title()}
      description={m.defaults_confirm_description({ mod })}
      confirm={m.defaults_confirm()}
      onConfirm={commitDefaultsActive}
      changes={(preview ?? []).map((rule) => ({
        name: rule.key,
        value: rule.value || m.defaults_confirm_empty(),
        title: rule.value,
        count: rule.count,
        countLabel: m.defaults_confirm_count_label({ count: rule.count }),
      }))}
    />
  )
}

/** Lists the values each variable gets before the filled-in copy opens. */
export function VarsConfirmDialog() {
  const preview = useSelector(uiStore, (s) => s.varsPreview)

  return (
    <ChangesDialog
      open={!!preview}
      onClose={() => setVarsPreview(null)}
      title={m.vars_confirm_title()}
      description={m.vars_confirm_description()}
      confirm={m.vars_confirm()}
      onConfirm={() => {
        if (preview) commitVarsPreview(preview)
      }}
      changes={(preview?.vars ?? []).map((v) => ({
        name: v.name,
        value:
          v.value === null
            ? m.vars_confirm_unset()
            : v.dynamic
              ? m.vars_confirm_dynamic({ value: v.value })
              : v.value || m.defaults_confirm_empty(),
        title: v.value ?? undefined,
        count: v.count,
        countLabel: m.vars_confirm_count_label({ count: v.count }),
      }))}
    />
  )
}

interface Change {
  name: string
  /** The value as listed. */
  value: string
  /** The value as written, when the list shows something else. */
  title?: string
  count: number
  countLabel: string
}

function ChangesDialog({
  open,
  onClose,
  title,
  description,
  confirm,
  onConfirm,
  changes,
}: {
  open: boolean
  onClose: () => void
  title: string
  description: string
  confirm: string
  onConfirm: () => void
  changes: Array<Change>
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="-mx-1 flex max-h-64 flex-col overflow-y-auto border-y py-1">
          {changes.map((change) => (
            <li
              key={change.name}
              className="flex items-center gap-3 px-1 py-1.5 font-mono text-xs"
            >
              <span className="w-32 shrink-0 truncate" title={change.name}>
                {change.name}
              </span>
              <span
                className="min-w-0 flex-1 truncate text-muted-foreground"
                title={change.title}
              >
                {change.value}
              </span>
              <span
                className="shrink-0 text-muted-foreground tabular-nums"
                aria-label={change.countLabel}
              >
                {m.defaults_confirm_count({ count: change.count })}
              </span>
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirm}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
