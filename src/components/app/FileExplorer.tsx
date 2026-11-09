import { exportMarkdownPdf } from '#/components/markdown/pdf/PdfExportDialog'
import { isMarkdownName } from '#/lib/obsidian'
import {
  IconBrowser,
  IconChevronRight,
  IconFolder,
  IconFolderRoot,
  IconFolderPlus,
  IconFilePlus,
  IconLayoutSidebarRight,
  IconUpload,
  IconChevronDown,
  IconFolderUp,
  IconPlus,
} from '@tabler/icons-react'
import { useLiveQuery } from '@tanstack/react-db'
import { useSelector } from '@tanstack/react-store'
import { useRef, useState } from 'react'
import { useMediaQuery } from '#/hooks/use-media-query'
import { openFolder } from './disk-workspace'
import { DiskWorkspace } from './DiskWorkspace'
import {
  NameDialog,
  RowAction,
  RowCount,
  RowMenu,
  WorkspaceHeader,
  activeRowClass,
  rowButtonClass,
  rowClass,
  scrollToRow,
} from './explorer-parts'
import type { NameRequest } from './explorer-parts'
import { importFiles, closeTabs } from './files'
import { FileIcon } from './FileIcon'
import { ToolbarButton } from './ToolbarButton'
import { askClose } from './ui-store'
import { notify } from './notice-store'
import { UnsavedMark } from './UnsavedMark'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '#/components/ui/dialog'
import { useCanOpenFolders } from '#/hooks/use-can-open-folders'
import { useOpenFiles } from '#/hooks/use-files'
import { createFile, filesCollection, renameFile } from '#/lib/store/files'
import {
  foldersCollection,
  saveFolder,
  moveFile,
  deleteFolder,
  canMoveFolder,
  folderPath,
} from '#/lib/store/folders'
import { rootsStore } from '#/lib/store/disk'
import { activeProfileId } from '#/lib/store/profiles'
import { setActive } from '#/lib/store/session'
import { downloadBlob } from '#/lib/file-io'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

type Edit = {
  kind: 'file' | 'folder'
  id?: string
  parentId: string | null
  name: string
}

/** The name dialog for a new or renamed entry of the browser's workspace. */
function browserRequest(edit: Edit): NameRequest {
  return {
    key: `${edit.kind}:${edit.id ?? edit.parentId}`,
    title: edit.id
      ? m.file_rename()
      : edit.kind === 'folder'
        ? m.explorer_new_folder()
        : m.file_new(),
    name: edit.name,
    submit: async (name) => {
      if (edit.kind === 'folder')
        return saveFolder(name, edit.parentId, edit.id)
      if (edit.id) await renameFile(edit.id, name)?.isPersisted.promise
      else {
        const file = createFile(name.trim(), '', activeProfileId())
        await moveFile(file.id, edit.parentId)
        setActive(file.id)
      }
      return true
    },
  }
}

/** A menu item that says, under its label, what it does with your files. */
function MenuEntry({
  icon,
  label,
  description,
  onSelect,
}: {
  icon: React.ReactNode
  label: string
  description: string
  onSelect: () => void
}) {
  return (
    <DropdownMenuItem className="items-start" onSelect={onSelect}>
      <span className="mt-0.5 flex">{icon}</span>
      <span className="flex flex-col gap-0.5">
        {label}
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
    </DropdownMenuItem>
  )
}

export function FileExplorer({
  activeId,
  onImport,
}: {
  activeId: string | null
  onImport: () => void
}) {
  const allFiles = useOpenFiles()
  const roots = useSelector(rootsStore, (state) => state)
  const canOpenFolders = useCanOpenFolders()
  // Tabs of open folders show in their own workspace, the rest in the browser's.
  const files = allFiles.filter(
    (file) =>
      !file.location ||
      !roots.some((root) => root.id === file.location?.rootId),
  )
  // Open tab ids of each folder's files, by path.
  const tabsByPath = new Map<string, Map<string, string>>()
  for (const file of allFiles) {
    if (!file.location) continue
    const tabs = tabsByPath.get(file.location.rootId) ?? new Map()
    tabs.set(file.location.path, file.id)
    tabsByPath.set(file.location.rootId, tabs)
  }
  const { data: folders } = useLiveQuery((q) =>
    q
      .from({ folder: foldersCollection })
      .orderBy(({ folder }) => folder.name, 'asc'),
  )
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [nameRequest, setNameRequest] = useState<NameRequest | null>(null)
  const setEdit = (edit: Edit) => {
    const request = browserRequest(edit)
    setNameRequest({
      ...request,
      submit: async (name) => {
        const done = await request.submit(name)
        // Show where the new or renamed entry is.
        if (done) {
          setBrowserOpen(true)
          setCollapsed(new Set())
        }
        return done
      },
    })
  }
  const newEntry = (kind: Edit['kind'], parentId: string | null) =>
    setEdit({
      kind,
      parentId,
      name: kind === 'file' ? m.file_untitled() : '',
    })
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [browserOpen, setBrowserOpen] = useState(true)
  // The tab in the editor shows in the tree: open its workspace and folders
  // whenever another one becomes active, then leave them as you set them.
  const activeFile = files.find((file) => file.id === activeId)
  const [revealed, setRevealed] = useState<string | null>(null)
  if ((activeFile?.id ?? null) !== revealed) {
    setRevealed(activeFile?.id ?? null)
  }
  if (activeFile && activeFile.id !== revealed) {
    setBrowserOpen(true)
    setCollapsed((previous) => {
      const next = new Set(previous)
      const seen = new Set<string>()
      let id = activeFile.folderId
      while (id && !seen.has(id)) {
        seen.add(id)
        next.delete(id)
        id = foldersCollection.get(id)?.parentId ?? null
      }
      return next
    })
  }
  const [expanded, setVisible] = useState<boolean | null>(null)
  const wide = useMediaQuery('(min-width: 768px)')
  const visible = expanded ?? wide
  const directoryInput = useRef<HTMLInputElement>(null)
  const run = (action: () => Promise<unknown>) => {
    void action().catch(() => notify.error(m.explorer_failed()))
  }
  const toggle = (id: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const move = (id: string, folder: boolean, parentId: string | null) =>
    run(async () => {
      if (folder) {
        const entry = foldersCollection.get(id)
        if (entry && !(await saveFolder(entry.name, parentId, id)))
          notify.error(m.explorer_invalid())
      } else await moveFile(id, parentId)
      setCollapsed((previous) => {
        const next = new Set(previous)
        if (parentId) next.delete(parentId)
        return next
      })
    })
  const destinations = (
    id: string,
    folder: boolean,
    parentId: string | null,
  ) => (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>{m.explorer_move()}</DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
        <DropdownMenuItem
          disabled={!parentId}
          onSelect={() => move(id, folder, null)}
        >
          {m.explorer_browser()}
        </DropdownMenuItem>
        {folders
          .filter((f) => !folder || canMoveFolder(id, f.id))
          .map((f) => (
            <DropdownMenuItem
              key={f.id}
              disabled={f.id === parentId}
              onSelect={() => move(id, folder, f.id)}
            >
              {folderPath(f.id)}
            </DropdownMenuItem>
          ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
  const menu = (entry: Edit & { id: string }) => (
    <RowMenu
      label={
        entry.kind === 'folder'
          ? m.explorer_folder_actions()
          : m.explorer_actions()
      }
    >
      <DropdownMenuItem onSelect={() => setEdit(entry)}>
        {m.file_rename()}
      </DropdownMenuItem>
      {destinations(entry.id, entry.kind === 'folder', entry.parentId)}
      {(entry.kind === 'folder' || isMarkdownName(entry.name)) && (
        <DropdownMenuItem
          onSelect={() => exportMarkdownPdf({ kind: entry.kind, id: entry.id })}
        >
          {entry.kind === 'folder' ? m.md_pdf_folder() : m.md_pdf_export()}
        </DropdownMenuItem>
      )}
      {entry.kind === 'folder' ? (
        <>
          <DropdownMenuItem onSelect={() => newEntry('file', entry.id)}>
            {m.file_new()}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => newEntry('folder', entry.id)}>
            {m.explorer_new_folder()}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDeleteId(entry.id)}>
            {m.explorer_delete_folder()}
          </DropdownMenuItem>
        </>
      ) : (
        <>
          <DropdownMenuItem
            onSelect={() =>
              run(async () => {
                const file = filesCollection.get(entry.id)
                if (!file) return
                const copy = createFile(file.name, file.content, file.profileId)
                if (file.zplSettings)
                  await filesCollection.update(copy.id, (draft) => {
                    draft.zplSettings = file.zplSettings
                  }).isPersisted.promise
                await moveFile(copy.id, entry.parentId)
                setActive(copy.id)
              })
            }
          >
            {m.explorer_duplicate()}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              const file = filesCollection.get(entry.id)
              if (file)
                downloadBlob(
                  new Blob([file.content], { type: 'text/plain' }),
                  file.name,
                )
            }}
          >
            {m.explorer_download()}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => askClose(entry.id)}>
            {m.close_confirm()}
          </DropdownMenuItem>
        </>
      )}
    </RowMenu>
  )
  const dropProps = (parentId: string | null) => ({
    onDragOver: (event: React.DragEvent) => {
      if (event.dataTransfer.types.includes('application/x-workspace-entry')) {
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
      }
    },
    onDrop: (event: React.DragEvent) => {
      const value = event.dataTransfer.getData('application/x-workspace-entry')
      if (!value) return
      event.preventDefault()
      event.stopPropagation()
      const [kind, id] = value.split(':')
      if (id) move(id, kind === 'folder', parentId)
    },
  })
  const drag = (event: React.DragEvent, kind: string, id: string) => {
    event.dataTransfer.setData('application/x-workspace-entry', `${kind}:${id}`)
    event.dataTransfer.effectAllowed = 'move'
  }
  const fileRow = (file: (typeof files)[number]) => (
    <div
      key={file.id}
      ref={file.id === activeId ? scrollToRow : undefined}
      className={cn(rowClass, file.id === activeId && activeRowClass)}
      draggable
      onDragStart={(e) => drag(e, 'file', file.id)}
    >
      <Button
        variant="ghost"
        className={cn(rowButtonClass, file.id === activeId && 'font-medium')}
        aria-current={file.id === activeId ? 'page' : undefined}
        title={`${folderPath(file.folderId)} / ${file.name}`}
        onClick={() => {
          setActive(file.id)
          if (!wide) setVisible(false)
        }}
        onDoubleClick={() =>
          setEdit({
            kind: 'file',
            id: file.id,
            parentId: file.folderId,
            name: file.name,
          })
        }
      >
        <FileIcon file={file} />
        <span className="truncate">{file.name}</span>
        <UnsavedMark fileId={file.id} />
      </Button>
      {menu({
        kind: 'file',
        id: file.id,
        parentId: file.folderId,
        name: file.name,
      })}
    </div>
  )
  const tree = (
    parentId: string | null,
    ancestors = new Set<string>(),
  ): React.ReactNode => (
    <>
      {folders
        .filter((f) => f.parentId === parentId && !ancestors.has(f.id))
        .map((folder) => (
          <Collapsible
            key={folder.id}
            open={!collapsed.has(folder.id)}
            onOpenChange={() => toggle(folder.id)}
          >
            <div
              className={rowClass}
              {...dropProps(folder.id)}
              draggable
              onDragStart={(e) => drag(e, 'folder', folder.id)}
            >
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className={rowButtonClass}>
                  {collapsed.has(folder.id) ? (
                    <IconChevronRight />
                  ) : (
                    <IconChevronDown />
                  )}
                  <IconFolder />
                  <span className="truncate">{folder.name}</span>
                </Button>
              </CollapsibleTrigger>
              {menu({
                kind: 'folder',
                id: folder.id,
                name: folder.name,
                parentId,
              })}
            </div>
            <CollapsibleContent className="ml-3 border-l pl-1">
              {tree(folder.id, new Set([...ancestors, folder.id]))}
            </CollapsibleContent>
          </Collapsible>
        ))}
      {files
        .filter(
          (f) =>
            (f.folderId && folders.some((d) => d.id === f.folderId)
              ? f.folderId
              : null) === parentId,
        )
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(fileRow)}
    </>
  )
  const removeFolderTree = async () => {
    if (!deleteId || deleting) return
    setDeleting(true)
    try {
      const ids = new Set([deleteId])
      let changed = true
      while (changed) {
        changed = false
        for (const folder of foldersCollection.values()) {
          if (
            folder.parentId &&
            ids.has(folder.parentId) &&
            !ids.has(folder.id)
          ) {
            ids.add(folder.id)
            changed = true
          }
        }
      }
      const children = files.filter(
        (file) => file.folderId && ids.has(file.folderId),
      )
      await closeTabs(
        children.map((file) => file.id),
        files.map((file) => file.id),
      )
      for (const id of [...ids].reverse()) {
        if (!(await deleteFolder(id)))
          throw new Error('Folder changed during deletion')
      }
      setDeleteId(null)
    } catch {
      notify.error(m.explorer_failed())
    } finally {
      setDeleting(false)
    }
  }
  return (
    <aside
      aria-label={m.explorer_title()}
      className={cn(
        'flex shrink-0 flex-col border-l bg-background',
        visible
          ? 'w-72 max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-30 max-md:w-[min(20rem,100%)]'
          : 'w-11',
      )}
    >
      <input
        ref={directoryInput}
        type="file"
        multiple
        {...{ webkitdirectory: '' }}
        className="hidden"
        onChange={(event) => {
          const selected = event.target.files
          if (selected) run(() => importFiles(selected))
          event.target.value = ''
        }}
      />
      <div className="flex h-12 shrink-0 items-center gap-1 border-b px-2 md:h-10">
        <ToolbarButton
          label={m.explorer_toggle()}
          hint={m.explorer_toggle_hint()}
          onClick={() => setVisible(!visible)}
        >
          <IconLayoutSidebarRight />
        </ToolbarButton>
        {visible && (
          <>
            <span className="min-w-0 flex-1 text-xs font-medium">
              {m.explorer_title()}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="xs"
                  className="aria-expanded:bg-muted max-md:h-9"
                >
                  <IconPlus data-icon="inline-start" />
                  {m.explorer_new()}
                  <IconChevronDown
                    data-icon="inline-end"
                    className="text-muted-foreground"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {m.explorer_in_browser()}
                  </DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => newEntry('file', null)}>
                    <IconFilePlus />
                    {m.file_new()}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => newEntry('folder', null)}>
                    <IconFolderPlus />
                    {m.explorer_new_folder()}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {m.explorer_from_device()}
                  </DropdownMenuLabel>
                  <MenuEntry
                    icon={<IconUpload />}
                    label={m.explorer_import()}
                    description={m.explorer_import_hint()}
                    onSelect={onImport}
                  />
                  <MenuEntry
                    icon={<IconFolderUp />}
                    label={m.explorer_import_folder()}
                    description={m.explorer_import_folder_hint()}
                    onSelect={() => directoryInput.current?.click()}
                  />
                  {canOpenFolders && (
                    <MenuEntry
                      icon={<IconFolderRoot />}
                      label={m.folder_open()}
                      description={m.folder_open_desc()}
                      onSelect={() => run(openFolder)}
                    />
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
      {visible && (
        <>
          <div className="p-2">
            <Input
              aria-label={m.explorer_search()}
              placeholder={m.explorer_search()}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div
            className="min-h-0 flex-1 overflow-auto px-2 pb-4"
            {...dropProps(null)}
          >
            <Collapsible open={browserOpen} onOpenChange={setBrowserOpen}>
              <WorkspaceHeader
                icon={<IconBrowser />}
                name={m.explorer_browser()}
                title={m.explorer_browser_hint()}
                open={browserOpen}
              >
                <RowCount count={files.length} />
                <RowAction
                  label={m.file_new()}
                  hint={m.explorer_in_browser()}
                  onClick={() => newEntry('file', null)}
                >
                  <IconFilePlus />
                </RowAction>
                <RowAction
                  label={m.explorer_new_folder()}
                  hint={m.explorer_in_browser()}
                  onClick={() => newEntry('folder', null)}
                >
                  <IconFolderPlus />
                </RowAction>
                <RowMenu label={m.folder_actions()}>
                  <DropdownMenuItem onSelect={onImport}>
                    <IconUpload />
                    {m.explorer_import()}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => directoryInput.current?.click()}
                  >
                    <IconFolderUp />
                    {m.explorer_import_folder()}
                  </DropdownMenuItem>
                </RowMenu>
              </WorkspaceHeader>
              <CollapsibleContent className="ml-3 border-l pl-1">
                {search
                  ? files
                      .filter((f) =>
                        `${folderPath(f.folderId)}/${f.name}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map(fileRow)
                  : tree(null)}
                {files.length === 0 && folders.length === 0 && (
                  <p className="p-2 text-xs text-muted-foreground">
                    {m.explorer_empty()}
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>
            {roots.map((root) => (
              <DiskWorkspace
                key={root.id}
                root={root}
                tabs={tabsByPath.get(root.id) ?? new Map()}
                activeId={activeId}
                search={search}
                askName={setNameRequest}
                onOpened={() => {
                  if (!wide) setVisible(false)
                }}
              />
            ))}
          </div>
        </>
      )}
      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteId(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{m.explorer_delete_folder()}</DialogTitle>
            <DialogDescription>
              {m.explorer_delete_description()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteId(null)}
            >
              {m.cancel()}
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void removeFolderTree()}
            >
              {m.explorer_delete_folder()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <NameDialog request={nameRequest} onClose={() => setNameRequest(null)} />
    </aside>
  )
}
