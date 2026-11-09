import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconChevronDown,
  IconPlus,
} from '@tabler/icons-react'
import type { MouseEvent, ReactNode } from 'react'

import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Separator } from '#/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import type { TableAlign } from '#/lib/markdown-table'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

// Both float over the editor, which keeps the focus: pressing them mustn't
// take it, or the caret and the toolbar around it would go away.
const keepFocus = (event: MouseEvent) => event.preventDefault()

/** The largest table the grid offers. */
export const PICKER_COLS = 8
export const PICKER_ROWS = 6

/** The grid `/table` opens, to pick a table's size. */
export function TablePicker({
  cols,
  rows,
  onHover,
  onPick,
}: {
  cols: number
  rows: number
  onHover: (cols: number, rows: number) => void
  onPick: () => void
}) {
  return (
    <div
      role="group"
      aria-label={m.md_table_grid()}
      onMouseDown={keepFocus}
      className="grid gap-2 p-2 font-sans"
    >
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${PICKER_COLS}, 1fr)` }}
      >
        {Array.from({ length: PICKER_ROWS * PICKER_COLS }, (_, index) => {
          const col = (index % PICKER_COLS) + 1
          const row = Math.floor(index / PICKER_COLS) + 1
          return (
            <button
              key={index}
              type="button"
              tabIndex={-1}
              aria-label={m.md_table_size({ cols: col, rows: row })}
              onMouseEnter={() => onHover(col, row)}
              onClick={onPick}
              className={cn(
                'size-3.5 border',
                col <= cols && row <= rows
                  ? 'border-foreground bg-foreground'
                  : 'bg-transparent',
              )}
            />
          )
        })}
      </div>
      <span className="text-center font-mono text-[11px] text-muted-foreground tabular-nums">
        {m.md_table_size({ cols, rows })}
      </span>
    </div>
  )
}

export function Hint({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

/** What the toolbar reads from the table around the caret. */
export interface TableToolbarInfo {
  align: TableAlign
  isHeader: boolean
  isOnlyColumn: boolean
}

export interface TableToolbarActions {
  addRow: () => void
  addColumn: () => void
  align: (align: TableAlign) => void
  deleteRow: () => void
  deleteColumn: () => void
  deleteTable: () => void
  /** Tells the editor a menu holds the focus, so the toolbar stays. */
  onMenuOpenChange: (open: boolean) => void
  /** Hands the focus back once the menu closes. */
  onMenuClosed: () => void
}

/** Edits the table around the caret. */
export function TableToolbar({
  info,
  actions,
}: {
  info: TableToolbarInfo
  actions: TableToolbarActions
}) {
  const aligns = [
    { value: 'left', label: m.md_table_align_left(), icon: <IconAlignLeft /> },
    {
      value: 'center',
      label: m.md_table_align_center(),
      icon: <IconAlignCenter />,
    },
    {
      value: 'right',
      label: m.md_table_align_right(),
      icon: <IconAlignRight />,
    },
  ] as const
  return (
    <TooltipProvider delayDuration={300}>
      <div
        role="toolbar"
        aria-label={m.md_table_toolbar()}
        onMouseDown={keepFocus}
        className="flex items-center gap-0.5 p-0.5 font-sans"
      >
        <Hint label={m.md_table_add_row()}>
          <Button variant="ghost" size="xs" onClick={actions.addRow}>
            <IconPlus data-icon="inline-start" />
            {m.md_table_row()}
          </Button>
        </Hint>
        <Hint label={m.md_table_add_column()}>
          <Button variant="ghost" size="xs" onClick={actions.addColumn}>
            <IconPlus data-icon="inline-start" />
            {m.md_table_column()}
          </Button>
        </Hint>
        <Separator orientation="vertical" className="mx-0.5 h-4 self-center" />
        <ToggleGroup
          type="single"
          spacing={0}
          aria-label={m.md_table_align()}
          value={info.align ?? ''}
          onValueChange={(value) =>
            actions.align(value === '' ? null : (value as TableAlign))
          }
        >
          {aligns.map(({ value, label, icon }) => (
            <Hint key={value} label={label}>
              <ToggleGroupItem
                value={value}
                aria-label={label}
                className="size-6 min-w-6 p-0! aria-checked:bg-muted [&_svg:not([class*='size-'])]:size-3.5"
              >
                {icon}
              </ToggleGroupItem>
            </Hint>
          ))}
        </ToggleGroup>
        <Separator orientation="vertical" className="mx-0.5 h-4 self-center" />
        <DropdownMenu modal={false} onOpenChange={actions.onMenuOpenChange}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="xs">
              {m.md_table_delete()}
              <IconChevronDown data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          {/* Above the toolbar, which CodeMirror floats over everything. */}
          <DropdownMenuContent
            align="end"
            className="z-[600] w-auto"
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              actions.onMenuClosed()
            }}
          >
            <DropdownMenuItem
              disabled={info.isHeader}
              onSelect={actions.deleteRow}
            >
              {m.md_table_delete_row()}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={info.isOnlyColumn}
              onSelect={actions.deleteColumn}
            >
              {m.md_table_delete_column()}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={actions.deleteTable}
            >
              {m.md_table_delete_table()}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  )
}
