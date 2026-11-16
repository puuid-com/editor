import { IconX } from '@tabler/icons-react'

import { FileIcon } from './FileIcon'
import { closeTab, setTabListOpen } from './ui-store'
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
import { setActive } from '#/lib/store/session'
import { m } from '#/paraglide/messages'
import type { TabFile } from './files'

/** The searchable list inside the tab list's popover. */
export function TabListItems({
  files,
  activeId,
}: {
  files: Array<TabFile>
  activeId: string | null
}) {
  return (
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
                  closeTab(file.id)
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
              closeTab(files.map((f) => f.id))
            }}
          >
            {m.tabs_close_all()}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
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
