import { IconChevronDown, IconX } from '@tabler/icons-react'

import { FileIcon } from './FileIcon'
import { ToolbarButton } from './ToolbarButton'
import { askClose, setTabListOpen } from './ui-store'
import { UnsavedMark } from './UnsavedMark'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '#/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { shortcuts } from '#/lib/shortcuts'
import { setActive } from '#/lib/store/session'
import { m } from '#/paraglide/messages'
import type { TabFile } from './files'

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
        <Command loop filter={matchKeywords}>
          <CommandInput placeholder={m.tabs_search()} />
          <CommandList>
            <CommandEmpty>{m.tabs_search_empty()}</CommandEmpty>
            <CommandGroup heading={m.palette_files()}>
              {files.map((file) => (
                <CommandItem
                  key={file.id}
                  value={file.id}
                  keywords={[file.name]}
                  data-checked={file.id === activeId}
                  onSelect={() => {
                    setActive(file.id)
                    setTabListOpen(false)
                  }}
                >
                  <FileIcon file={file} />
                  <span className="min-w-0 flex-1 truncate font-mono">
                    {file.name}
                  </span>
                  <UnsavedMark fileId={file.id} />
                  <button
                    type="button"
                    aria-label={m.tab_close({ name: file.name })}
                    onClick={(e) => {
                      e.stopPropagation()
                      askClose(file.id)
                    }}
                    className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground opacity-0 group-hover/command-item:opacity-100 group-data-selected/command-item:opacity-100 hover:bg-background hover:text-foreground"
                  >
                    <IconX className="size-3" />
                  </button>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="close-all"
                keywords={[m.tabs_close_all()]}
                onSelect={() => {
                  setTabListOpen(false)
                  askClose(files.map((f) => f.id))
                }}
              >
                {m.tabs_close_all()}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// Items are keyed by id, so search only what people can read.
function matchKeywords(
  _value: string,
  search: string,
  keywords?: Array<string>,
) {
  const query = search.toLowerCase()
  return keywords?.some((word) => word.toLowerCase().includes(query)) ? 1 : 0
}
