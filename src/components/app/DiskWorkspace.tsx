import { exportMarkdownPdf } from '#/components/markdown/pdf/PdfExportDialog'
import {
  IconChevronDown,
  IconChevronRight,
  IconFilePlus,
  IconFolder,
  IconFolderPlus,
  IconFolderRoot,
  IconNotebook,
} from '@tabler/icons-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { ReactNode } from 'react'

import {
  closeFolder,
  createDiskEntry,
  deleteDiskEntry,
  openDiskFile,
  reconnectFolder,
  reloadFromDisk,
  renameDiskEntry,
} from './disk-workspace'
import {
  diskKeys,
  directoryQuery,
  filesQuery,
  vaultQuery,
} from './disk-queries'
import {
  RowAction,
  RowMenu,
  WorkspaceHeader,
  activeRowClass,
  rowButtonClass,
  rowClass,
} from './explorer-parts'
import type { NameRequest } from './explorer-parts'
import { FileIcon } from './FileIcon'
import { notify } from './notice-store'
import { UnsavedMark } from './UnsavedMark'
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
import { Button } from '#/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import { DropdownMenuItem } from '#/components/ui/dropdown-menu'
import { isEditableName, isWithin, parentPath } from '#/lib/disk-tree'
import type { DiskEntry, EntryKind } from '#/lib/disk-tree'
import {
  isAttachmentFolder,
  isExcluded,
  isMarkdownName,
  noteName,
} from '#/lib/obsidian'
import type { Vault } from '#/lib/obsidian'
import type { DiskRoot } from '#/lib/store/disk'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

// A folder opened from disk, as one workspace of the explorer. Its listing
// is read from disk as folders open, and read again when the page regains
// focus, so files added or removed in other apps show up. An Obsidian vault
// says so, keeps its attachment folder out of the tree and its excluded
// files out of search, and names new files as notes.

/** What every row of one folder's tree needs. */
interface Tree {
  root: DiskRoot
  /** Its Obsidian vault settings, or null when it isn't a vault. */
  vault: Vault | null
  /** Open tab ids by path. */
  tabs: ReadonlyMap<string, string>
  activeId: string | null
  expanded: ReadonlySet<string>
  toggle: (path: string) => void
  open: (entry: DiskEntry) => void
  create: (parent: string, kind: EntryKind) => void
  rename: (entry: DiskEntry) => void
  remove: (entry: DiskEntry) => void
}

export function DiskWorkspace({
  root,
  tabs,
  activeId,
  search,
  askName,
  onOpened,
}: {
  root: DiskRoot
  tabs: ReadonlyMap<string, string>
  activeId: string | null
  search: string
  askName: (request: NameRequest) => void
  onOpened: () => void
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(true)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [deleting, setDeleting] = useState<DiskEntry | null>(null)
  const [busy, setBusy] = useState(false)
  const granted = root.access === 'granted'
  const { data: vault = null, isPending: vaultPending } = useQuery({
    ...vaultQuery(root),
    enabled: granted,
  })
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: diskKeys.root(root.id) })
  const expand = (path: string) =>
    setExpanded((previous) => new Set(previous).add(path))

  const tree: Tree = {
    root,
    vault,
    tabs,
    activeId,
    expanded,
    toggle: (path) =>
      setExpanded((previous) => {
        const next = new Set(previous)
        if (!next.delete(path)) next.add(path)
        return next
      }),
    open: (entry) => {
      void openDiskFile(root, entry)
      onOpened()
    },
    create: (parent, kind) =>
      askName({
        key: `new:${kind}:${root.id}/${parent}`,
        title: kind === 'file' ? m.file_new() : m.explorer_new_folder(),
        name:
          kind === 'directory'
            ? ''
            : vault
              ? m.file_untitled_md()
              : m.file_untitled(),
        submit: async (name) => {
          const done = await createDiskEntry(
            root,
            parent,
            vault && kind === 'file' ? noteName(name) : name,
            kind,
          )
          if (done) {
            setOpen(true)
            if (parent) expand(parent)
            await refresh()
          }
          return done
        },
      }),
    rename: (entry) =>
      askName({
        key: `rename:${root.id}/${entry.path}`,
        title: m.file_rename(),
        name: entry.name,
        submit: async (name) => {
          const done = await renameDiskEntry(root, entry, name)
          if (done) await refresh()
          return done
        },
      }),
    remove: setDeleting,
  }

  const confirmDelete = async () => {
    if (!deleting || busy) return
    setBusy(true)
    const entry = deleting
    if (await deleteDiskEntry(root, entry)) {
      // Its folder, and any open below it, would only show it again.
      setExpanded(
        (previous) =>
          new Set([...previous].filter((path) => !isWithin(path, entry.path))),
      )
      setDeleting(null)
      await refresh()
    }
    setBusy(false)
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
      <WorkspaceHeader
        icon={vault ? <IconNotebook /> : <IconFolderRoot />}
        name={root.name}
        title={vault ? m.vault_on_device() : m.folder_on_device()}
        open={open}
      >
        {!granted && (
          <Button
            variant="outline"
            size="xs"
            className="mr-1 shrink-0"
            onClick={() =>
              void reconnectFolder(root).then(async (done) => {
                if (done) await refresh()
              })
            }
          >
            {m.folder_reconnect()}
          </Button>
        )}
        {granted && (
          <>
            <RowAction
              label={m.file_new()}
              hint={m.explorer_in_folder({ name: root.name })}
              onClick={() => tree.create('', 'file')}
            >
              <IconFilePlus />
            </RowAction>
            <RowAction
              label={m.explorer_new_folder()}
              hint={m.explorer_in_folder({ name: root.name })}
              onClick={() => tree.create('', 'directory')}
            >
              <IconFolderPlus />
            </RowAction>
          </>
        )}
        <RowMenu label={m.folder_actions()}>
          <DropdownMenuItem
            disabled={!granted}
            onSelect={() =>
              exportMarkdownPdf({
                kind: 'disk',
                root,
                path: '',
                directory: true,
              })
            }
          >
            {m.md_pdf_folder()}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!granted} onSelect={() => void refresh()}>
            {m.folder_refresh()}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              void closeFolder(root).catch(() =>
                notify.error(m.explorer_failed()),
              )
            }
          >
            {m.folder_close()}
          </DropdownMenuItem>
        </RowMenu>
      </WorkspaceHeader>
      <CollapsibleContent className="ml-3 border-l pl-1">
        {!granted ? (
          <Hint>{m.folder_access_hint()}</Hint>
        ) : vaultPending ? (
          // Until then a vault's attachment folder would show for a moment.
          <Hint>{m.folder_loading()}</Hint>
        ) : search ? (
          <SearchResults tree={tree} search={search} />
        ) : (
          <Directory tree={tree} path="" />
        )}
      </CollapsibleContent>
      <AlertDialog
        open={!!deleting}
        onOpenChange={(next) => {
          if (!next && !busy) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {m.folder_delete_title({ name: deleting?.name ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {m.folder_delete_description()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault()
                void confirmDelete()
              }}
            >
              {m.folder_delete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  )
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="px-2 py-1.5 text-xs text-muted-foreground">{children}</p>
}

function Directory({ tree, path }: { tree: Tree; path: string }) {
  const { data, isPending, isError } = useQuery(directoryQuery(tree.root, path))
  if (isPending) return <Hint>{m.folder_loading()}</Hint>
  if (isError) return <Hint>{m.folder_unavailable()}</Hint>
  // A vault's attachments are images and such, nothing to edit.
  const entries = data.filter(
    (entry) =>
      entry.kind === 'file' || !isAttachmentFolder(tree.vault, entry.path),
  )
  if (!entries.length) return <Hint>{m.folder_empty()}</Hint>
  return entries.map((entry) =>
    entry.kind === 'directory' ? (
      <DirectoryRow key={entry.path} tree={tree} entry={entry} />
    ) : (
      <FileRow key={entry.path} tree={tree} entry={entry} />
    ),
  )
}

function DirectoryRow({ tree, entry }: { tree: Tree; entry: DiskEntry }) {
  const open = tree.expanded.has(entry.path)
  return (
    <Collapsible open={open} onOpenChange={() => tree.toggle(entry.path)}>
      <div className={rowClass}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className={rowButtonClass}>
            {open ? <IconChevronDown /> : <IconChevronRight />}
            <IconFolder />
            <span className="truncate">{entry.name}</span>
          </Button>
        </CollapsibleTrigger>
        <RowMenu label={m.explorer_folder_actions()}>
          <DropdownMenuItem
            onSelect={() =>
              exportMarkdownPdf({
                kind: 'disk',
                root: tree.root,
                path: entry.path,
                directory: true,
              })
            }
          >
            {m.md_pdf_folder()}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => tree.create(entry.path, 'file')}>
            {m.file_new()}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => tree.create(entry.path, 'directory')}
          >
            {m.explorer_new_folder()}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => tree.rename(entry)}>
            {m.file_rename()}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => tree.remove(entry)}>
            {m.folder_delete()}
          </DropdownMenuItem>
        </RowMenu>
      </div>
      <CollapsibleContent className="ml-3 border-l pl-1">
        {/* Read only once opened, so a large folder costs nothing closed. */}
        {open && <Directory tree={tree} path={entry.path} />}
      </CollapsibleContent>
    </Collapsible>
  )
}

function FileRow({
  tree,
  entry,
  showPath,
}: {
  tree: Tree
  entry: DiskEntry
  showPath?: boolean
}) {
  const tabId = tree.tabs.get(entry.path)
  const active = !!tabId && tabId === tree.activeId
  const folder = parentPath(entry.path)
  // Files the editor can't open still show, to rename or delete, but stay shut.
  const editable = isEditableName(entry.name)
  const title = `${tree.root.name}/${entry.path}`
  return (
    <div className={cn(rowClass, active && activeRowClass)}>
      <Button
        variant="ghost"
        className={cn(
          rowButtonClass,
          active && 'font-medium',
          !editable && 'cursor-default opacity-50',
        )}
        aria-current={active ? 'page' : undefined}
        aria-disabled={!editable || undefined}
        title={editable ? title : `${title}\n${m.folder_unsupported_file()}`}
        onClick={editable ? () => tree.open(entry) : undefined}
      >
        <FileIcon file={{ name: entry.name, empty: false }} />
        <span className="truncate">{entry.name}</span>
        {showPath && folder && (
          <span className="truncate text-xs text-muted-foreground">
            {folder}
          </span>
        )}
        {tabId && <UnsavedMark fileId={tabId} />}
      </Button>
      <RowMenu label={m.explorer_actions()}>
        {isMarkdownName(entry.name) && (
          <DropdownMenuItem
            onSelect={() =>
              exportMarkdownPdf({
                kind: 'disk',
                root: tree.root,
                path: entry.path,
                directory: false,
              })
            }
          >
            {m.md_pdf_export()}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => tree.rename(entry)}>
          {m.file_rename()}
        </DropdownMenuItem>
        {tabId && (
          <DropdownMenuItem onSelect={() => void reloadFromDisk(tabId)}>
            {m.folder_reload()}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => tree.remove(entry)}>
          {m.folder_delete()}
        </DropdownMenuItem>
      </RowMenu>
    </div>
  )
}

/** Files anywhere in the folder whose path holds the search, but for a vault’s excluded files. */
function SearchResults({ tree, search }: { tree: Tree; search: string }) {
  const { data, isPending, isError } = useQuery(filesQuery(tree.root))
  if (isPending) return <Hint>{m.folder_loading()}</Hint>
  if (isError) return <Hint>{m.folder_unavailable()}</Hint>
  const query = search.toLowerCase()
  return data
    .filter(
      (entry) =>
        entry.path.toLowerCase().includes(query) &&
        !isExcluded(tree.vault, entry.path),
    )
    .map((entry) => (
      <FileRow key={entry.path} tree={tree} entry={entry} showPath />
    ))
}
