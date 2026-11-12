import { useDragFeedback } from '#/hooks/use-drag-feedback'
import { exportMarkdownPdf } from '#/components/markdown/pdf/PdfExportDialog'
import { isMarkdownName } from '#/lib/obsidian'
import {
  IconBrowser,
  IconChevronRight,
  IconFolder,
  IconFolderRoot,
  IconFolderPlus,
  IconFilePlus,
  IconSearch,
  IconUpload,
  IconChevronDown,
  IconFolderUp,
  IconPlus,
} from '@tabler/icons-react'
import { useLiveQuery } from '@tanstack/react-db'
import { useSelector } from '@tanstack/react-store'
import { useRef, useState } from 'react'
import { openFolder } from './disk-workspace'
import { DiskWorkspace } from './DiskWorkspace'
import {
  NameDialog,
  RowAction,
  RowCount,
  RowMenu,
  WorkspaceHeader,
  activeRowClass,
  nestClass,
  rowButtonClass,
  rowClass,
  scrollToRow,
} from './explorer-parts'
import type { NameRequest } from './explorer-parts'
import { deleteFolders, importFiles, showFile } from './files'
import { FileIcon } from './FileIcon'
import { ToolbarButton } from './ToolbarButton'
import { askDelete, closeTab, setPaletteOpen } from './ui-store'
import { ArchiveButton } from './ArchiveDialog'
import { CodeFontMenu } from './CodeFontMenu'
import { ThemeToggle } from './ThemeToggle'
import { WordWrapToggle } from './WordWrapToggle'
import { SidebarSideToggle } from './SidebarSideToggle'
import { editorPrefs } from '#/components/editor/word-wrap'
import { notify } from './notice-store'
import { UnsavedMark } from './UnsavedMark'
import { Logo } from '#/components/Logo'
import { Button } from '#/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '#/components/ui/input-group'
import { Kbd } from '#/components/ui/kbd'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '#/components/ui/sidebar'
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
import type { WorkspaceFile } from '#/hooks/use-files'
import { createFile, filesCollection, renameFile } from '#/lib/store/files'
import {
  foldersCollection,
  saveFolder,
  moveFile,
  canMoveFolder,
  folderPath,
  folderTreeIds,
} from '#/lib/store/folders'
import { rootsStore } from '#/lib/store/disk'
import { activeProfileId } from '#/lib/store/profiles'
import { setActive } from '#/lib/store/session'
import { downloadBlob } from '#/lib/file-io'
import { shortcutLabel, shortcuts } from '#/lib/shortcuts'
import { cn } from '#/lib/utils'
import { appVersion } from '#/lib/version'
import { m } from '#/paraglide/messages'
import { site } from '#/site'
import { Link } from '@tanstack/react-router'

/** What a dragged file or folder of the browser's workspace carries. */
const ENTRY_DRAG = 'application/x-workspace-entry'

/** `items` by `key`, each group in the order its items came in. */
function groupBy<TItem, TKey>(
  items: ReadonlyArray<TItem>,
  key: (item: TItem) => TKey,
) {
  const groups = new Map<TKey, Array<TItem>>()
  for (const item of items) {
    const group = groups.get(key(item))
    if (group) group.push(item)
    else groups.set(key(item), [item])
  }
  return groups
}

type Edit = {
  kind: 'file' | 'folder'
  id?: string
  parentId: string | null
  name: string
  /** A file whose tab is closed. */
  closed?: boolean
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
  files: allFiles,
  activeId,
  onImport,
}: {
  /** Every file of the workspace, with a tab or not. */
  files: Array<WorkspaceFile>
  activeId: string | null
  onImport: () => void
}) {
  const dragFeedback = useDragFeedback()
  const roots = useSelector(rootsStore, (state) => state)
  const sidebarRight = useSelector(editorPrefs, (s) => s.sidebarRight)
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
  // The tree by parent, built once rather than searched again per folder. A
  // file whose folder is gone shows at the top.
  const folderIds = new Set(folders.map((folder) => folder.id))
  const foldersIn = groupBy(folders, (folder) => folder.parentId)
  const filesIn = groupBy(
    [...files].sort((a, b) => a.name.localeCompare(b.name)),
    (file) =>
      file.folderId && folderIds.has(file.folderId) ? file.folderId : null,
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
  // On phones the sidebar is a drawer, which closes once a file is picked.
  const { isMobile, setOpenMobile } = useSidebar()
  const closeDrawer = () => {
    if (isMobile) setOpenMobile(false)
  }
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
          {!entry.closed && (
            <DropdownMenuItem onSelect={() => closeTab(entry.id)}>
              {m.tabs_close()}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => askDelete(entry.id)}
          >
            {m.explorer_delete_file()}
          </DropdownMenuItem>
        </>
      )}
    </RowMenu>
  )
  const dropProps = (parentId: string | null) => ({
    onDragOver: (event: React.DragEvent) => {
      if (event.dataTransfer.types.includes(ENTRY_DRAG)) {
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
        dragFeedback.over(event)
      }
    },
    onDragLeave: dragFeedback.leave,
    onDrop: (event: React.DragEvent) => {
      dragFeedback.clear()
      const value = event.dataTransfer.getData(ENTRY_DRAG)
      if (!value) return
      event.preventDefault()
      event.stopPropagation()
      const [kind, id] = value.split(':')
      if (id) move(id, kind === 'folder', parentId)
    },
  })
  const drag = (event: React.DragEvent, kind: string, id: string) => {
    event.dataTransfer.setData(ENTRY_DRAG, `${kind}:${id}`)
    event.dataTransfer.effectAllowed = 'move'
    dragFeedback.start(event)
  }
  const fileRow = (file: (typeof files)[number]) => (
    <div
      key={file.id}
      {...dropProps(file.folderId)}
      ref={file.id === activeId ? scrollToRow : undefined}
      className={cn(rowClass, file.id === activeId && activeRowClass)}
      draggable
      onDragStart={(e) => drag(e, 'file', file.id)}
    >
      <Button
        variant="ghost"
        className={cn(
          rowButtonClass,
          file.id === activeId && 'font-medium',
          // Closed tabs stay listed, quieter than the open ones.
          file.closed && 'text-muted-foreground',
        )}
        aria-current={file.id === activeId ? 'page' : undefined}
        title={`${folderPath(file.folderId)} / ${file.name}`}
        onClick={() => {
          run(() => showFile(file.id))
          closeDrawer()
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
        closed: file.closed,
      })}
    </div>
  )
  const tree = (
    parentId: string | null,
    ancestors = new Set<string>(),
  ): React.ReactNode => (
    <>
      {foldersIn
        .get(parentId)
        ?.filter((folder) => !ancestors.has(folder.id))
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
            <CollapsibleContent className={nestClass} {...dropProps(folder.id)}>
              {tree(folder.id, new Set([...ancestors, folder.id]))}
            </CollapsibleContent>
          </Collapsible>
        ))}
      {filesIn.get(parentId)?.map(fileRow)}
    </>
  )
  const removeFolderTree = () => {
    if (!deleteId || deleting) return
    setDeleting(true)
    const ids = folderTreeIds(deleteId)
    const children = files.filter(
      (file) => file.folderId && ids.has(file.folderId),
    )
    return deleteFolders(
      ids,
      children.map((file) => file.id),
    )
      .then(() => setDeleteId(null))
      .catch(() => notify.error(m.explorer_failed()))
      .finally(() => setDeleting(false))
  }
  return (
    <Sidebar
      side={sidebarRight ? 'right' : 'left'}
      variant="inset"
      collapsible="icon"
    >
      <aside
        aria-label={m.explorer_title()}
        className="flex size-full min-h-0 flex-col"
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
        <SidebarHeader className="gap-2 group-data-[collapsible=icon]:items-center">
          <div className="flex h-8 items-center gap-1 group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:flex-col">
            <Link
              to="/about"
              aria-label={m.nav_about()}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Logo className="size-6 shrink-0" />
              <span className="truncate group-data-[collapsible=icon]:hidden">
                {site.name}
              </span>
            </Link>
            <SidebarTrigger className="text-muted-foreground max-md:size-11" />
            {/* Collapsed, the search field and New menu are icons. */}
            <ToolbarButton
              label={m.palette_open()}
              shortcut={shortcuts.palette}
              size="icon-sm"
              className="hidden text-muted-foreground group-data-[collapsible=icon]:inline-flex"
              onClick={() => setPaletteOpen(true)}
            >
              <IconSearch />
            </ToolbarButton>
          </div>
          <div className="flex items-center gap-1.5 group-data-[collapsible=icon]:hidden">
            <InputGroup className="bg-background">
              <InputGroupAddon>
                <IconSearch />
              </InputGroupAddon>
              <InputGroupInput
                aria-label={m.explorer_search()}
                placeholder={m.explorer_search()}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {/* Phones have no ⌘K; their pane header has the search button. */}
              {!isMobile && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    aria-label={m.palette_open()}
                    title={m.palette_placeholder()}
                    onClick={() => setPaletteOpen(true)}
                  >
                    <Kbd>{shortcutLabel(shortcuts.palette)}</Kbd>
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={m.explorer_new()}
                  className="shrink-0 aria-expanded:bg-muted"
                >
                  <IconPlus />
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
          </div>
        </SidebarHeader>
        <SidebarContent
          className="px-2 pb-2 group-data-[collapsible=icon]:invisible"
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
            <CollapsibleContent className={nestClass} {...dropProps(null)}>
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
              onOpened={closeDrawer}
            />
          ))}
        </SidebarContent>
        <SidebarFooter className="flex-row items-center gap-0.5 group-data-[collapsible=icon]:flex-col">
          <ArchiveButton />
          <WordWrapToggle />
          <SidebarSideToggle />
          <CodeFontMenu />
          <ThemeToggle />
          <Link
            to="/changelog"
            aria-label={m.app_version_label({ version: appVersion })}
            className="ml-auto rounded-md px-1.5 py-1 font-mono text-[11px] text-muted-foreground tabular-nums outline-none group-data-[collapsible=icon]:hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {m.app_version({ version: appVersion })}
          </Link>
        </SidebarFooter>
      </aside>
      {!isMobile && <SidebarRail />}
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
    </Sidebar>
  )
}
