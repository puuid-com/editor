import {
  IconChevronDown,
  IconChevronRight,
  IconDots,
} from '@tabler/icons-react'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { ToolbarButton } from './ToolbarButton'
import { Button } from '#/components/ui/button'
import { CollapsibleTrigger } from '#/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { useActiveProfile, useFormatSettings } from '#/hooks/use-profiles'
import { fileTypeOf } from '#/lib/file-types'
import {
  hideFileType,
  setFormatSetting,
  showFileType,
} from '#/lib/store/profiles'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { validEntryName } from '#/lib/store/folders'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

// Pieces every workspace of the explorer shares: the browser's own and each
// folder opened from disk.

/** A tree row owns its hover and selected colors; the buttons inside stay flat. */
export const rowClass =
  'group/row flex min-w-0 items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground has-[[aria-haspopup=menu][aria-expanded=true]]:bg-sidebar-accent has-[[aria-haspopup=menu][aria-expanded=true]]:text-foreground'
export const rowButtonClass =
  'h-8 min-w-0 flex-1 justify-start px-2 font-normal hover:bg-transparent hover:text-inherit aria-expanded:bg-transparent aria-expanded:text-inherit md:h-7 dark:hover:bg-transparent'
/** The selected row: the file in the editor. */
export const activeRowClass =
  'bg-sidebar-accent text-foreground hover:bg-sidebar-accent'
/** What a folder or workspace holds, set in from its row along a guide line. */
export const nestClass = 'ml-3.5 border-l border-sidebar-border pl-1.5'

/** Set on the selected row, so the explorer scrolls to it as it opens. */
export function scrollToRow(node: HTMLElement | null) {
  node?.scrollIntoView({ block: 'nearest' })
}

/** The "…" menu: on wide screens it shows on hover or focus, in its own space. */
const rowMenuClass =
  'shrink-0 hover:bg-foreground/10 aria-expanded:bg-foreground/10 md:opacity-0 md:group-focus-within/row:opacity-100 md:group-hover/row:opacity-100 md:aria-expanded:opacity-100 dark:hover:bg-foreground/10'
/** Other row buttons take the count's place on hover, on focus or while the menu is open. */
const rowActionClass =
  'shrink-0 hover:bg-foreground/10 md:hidden md:group-focus-within/row:inline-flex md:group-hover/row:inline-flex md:group-has-[[aria-haspopup=menu][aria-expanded=true]]/row:inline-flex dark:hover:bg-foreground/10'

/** An icon button at the end of a row, such as "New file" on a workspace. */
export function RowAction({
  label,
  hint,
  onClick,
  children,
}: {
  label: string
  /** Where it acts, such as "In Browser". */
  hint: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <ToolbarButton
      label={label}
      hint={hint}
      className={rowActionClass}
      onClick={onClick}
    >
      {children}
    </ToolbarButton>
  )
}

/**
 * The "…" menu at the end of a row. Pass `open` and `onOpenChange` to also
 * open it from elsewhere, such as a right-click on the row.
 */
export function RowMenu({
  label,
  open,
  onOpenChange,
  children,
}: {
  label: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton label={label} className={cn(rowMenuClass, 'mr-1')}>
          <IconDots />
        </ToolbarButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Opens a row's menu on right-click, in place of the browser's own. */
export function useRowContextMenu() {
  const [open, setOpen] = useState(false)
  return {
    menu: { open, onOpenChange: setOpen },
    row: {
      onContextMenu: (event: React.MouseEvent) => {
        event.preventDefault()
        setOpen(true)
      },
    },
  }
}

/** The extensions the active profile leaves out of the explorer. */
export function useHiddenTypes() {
  return useFormatSettings().hiddenTypes
}

/** A file menu's "Hide .ext files", for names that have an extension. */
export function HideTypeItem({ name }: { name: string }) {
  const type = fileTypeOf(name)
  if (!type) return null
  return (
    <DropdownMenuItem onSelect={() => hideFileType(type)}>
      {m.explorer_hide_type({ type })}
    </DropdownMenuItem>
  )
}

/** A workspace menu's list of hidden types, each to show again. */
export function HiddenTypesMenu() {
  const profile = useActiveProfile()
  const hidden = useHiddenTypes()
  if (!hidden.length) return null
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        {m.explorer_hidden_types()}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
        {profile && (
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {m.explorer_hidden_types_hint({ name: profile.name })}
          </DropdownMenuLabel>
        )}
        {hidden.map((type) => (
          <DropdownMenuItem key={type} onSelect={() => showFileType(type)}>
            {m.explorer_show_type({ type })}
          </DropdownMenuItem>
        ))}
        {hidden.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setFormatSetting('hiddenTypes', [])}
            >
              {m.explorer_show_all_types()}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

/** A workspace's file count, which gives way to its buttons on hover. */
export function RowCount({ count }: { count: number }) {
  return (
    <span className="mr-1 shrink-0 px-1 text-xs text-muted-foreground tabular-nums md:group-focus-within/row:hidden md:group-hover/row:hidden md:group-has-[[aria-haspopup=menu][aria-expanded=true]]/row:hidden">
      {count}
    </span>
  )
}

/**
 * The top row of a workspace, inside its `Collapsible`: its own icon and
 * name, then anything it needs, such as a count or a reconnect button.
 */
export function WorkspaceHeader({
  icon,
  name,
  title,
  open,
  children,
}: {
  icon: ReactNode
  name: string
  title: string
  open: boolean
  children?: ReactNode
}) {
  return (
    <div className={cn(rowClass, 'text-foreground')}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          title={title}
          className={cn(rowButtonClass, 'font-medium')}
        >
          {open ? <IconChevronDown /> : <IconChevronRight />}
          {icon}
          <span className="truncate">{name}</span>
          <span className="sr-only">{`, ${title}`}</span>
        </Button>
      </CollapsibleTrigger>
      {children}
    </div>
  )
}

/** Asks for a name, such as for a new file or a rename. */
export interface NameRequest {
  /** Tells requests apart, so each starts from its own name. */
  key: string
  title: string
  name: string
  /** Resolves false to keep the dialog open, marked invalid. */
  submit: (name: string) => Promise<boolean>
}

export function NameDialog({
  request,
  onClose,
}: {
  request: NameRequest | null
  onClose: () => void
}) {
  return (
    <Dialog
      open={!!request}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-sm">
        {request && (
          <NameForm key={request.key} request={request} done={onClose} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function NameForm({
  request,
  done,
}: {
  request: NameRequest
  done: () => void
}) {
  const [error, setError] = useState(false)
  const form = useForm({
    defaultValues: { name: request.name },
    onSubmit: async ({ value }) => {
      setError(false)
      try {
        if (await request.submit(value.name)) done()
        else setError(true)
      } catch {
        setError(true)
      }
    },
  })
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <DialogHeader>
        <DialogTitle>{request.title}</DialogTitle>
        <DialogDescription>{m.explorer_name_hint()}</DialogDescription>
      </DialogHeader>
      <form.Field
        name="name"
        validators={{
          onChange: ({ value }) =>
            validEntryName(value) ? undefined : m.explorer_invalid(),
        }}
      >
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor="entry-name">{m.rename_label()}</Label>
            <Input
              id="entry-name"
              autoFocus
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={!!field.state.meta.errors.length}
            />
            {field.state.meta.errors.map((message) => (
              <p key={message} className="text-xs text-destructive">
                {message}
              </p>
            ))}
          </div>
        )}
      </form.Field>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {m.explorer_invalid()}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" type="button" onClick={done}>
          {m.cancel()}
        </Button>
        <form.Subscribe selector={(s) => s.canSubmit && !s.isSubmitting}>
          {(enabled) => (
            <Button type="submit" disabled={!enabled}>
              {m.explorer_save()}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  )
}
