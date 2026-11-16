import { IconChevronDown } from '@tabler/icons-react'
import { Suspense } from 'react'

import { ToolbarButton } from './ToolbarButton'
import { setTabListOpen } from './ui-store'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { lazyPart } from '#/lib/lazy'
import { shortcuts } from '#/lib/shortcuts'
import { m } from '#/paraglide/messages'
import type { TabFile } from './files'

// The list is a command palette of its own; only its button shows at first.
const TabListItems = lazyPart(() =>
  import('./on-demand').then((mod) => mod.TabListItems),
)

/** Every open tab in a searchable list, for when the strip can't show them all. */
export function TabList({
  files,
  activeId,
  open,
}: {
  files: Array<TabFile>
  activeId: string | null
  open: boolean
}) {
  return (
    <Popover open={open} onOpenChange={setTabListOpen}>
      <PopoverTrigger asChild>
        <ToolbarButton
          label={m.tabs_list()}
          shortcut={shortcuts.tabList}
          size="xs"
          className="font-mono tabular-nums"
        >
          <IconChevronDown />
          {files.length}
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <Suspense>
          <TabListItems files={files} activeId={activeId} />
        </Suspense>
      </PopoverContent>
    </Popover>
  )
}
