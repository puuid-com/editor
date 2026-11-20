import { useDragFeedback } from '#/hooks/use-drag-feedback'
import { exportMarkdownPdf } from '#/components/markdown/pdf/export-store'
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
  HiddenTypesMenu,
  HideTypeItem,
  RowAction,
  RowCount,
  RowMenu,
  WorkspaceHeader,
  useHiddenTypes,
} from './explorer-parts'
import {
  activeRowClass,
  nestClass,
  rowButtonClass,
  rowClass,
  scrollToRow,
} from './explorer-rows'
import type { NameRequest } from './NameDialog'
import { Once } from './Once'
import { deleteFolders, importFiles, showFile } from './files'
import { FileIcon } from './FileIcon'
import { ToolbarButton } from './ToolbarButton'
import { askDelete, closeTab, setPalette } from './ui-store'
import { ArchiveButton, SettingsButton } from './SidebarButtons'
import { editorPrefs } from '#/components/editor/word-wrap'
import { notify } from './notice-store'
import { UnsavedMark } from './UnsavedMark'
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
import { lazyPart } from '#/lib/lazy'
import { isHiddenType } from '#/lib/file-types'
import { shortcutLabel, shortcuts } from '#/lib/shortcuts'
import { cn } from '#/lib/utils'
import { appVersion } from '#/lib/version'
import { m } from '#/paraglide/messages'
import { Link } from '@tanstack/react-router'

/** What a dragged file or folder of the browser's workspace carries. */
const NameDialog = lazyPart(() =>
  import('./on-demand').then((mod) => mod.NameDialog),
)

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

type FolderRow = { id: string; name: string; parentId: string | null }
type BrowserFile = WorkspaceFile

/** What the browser's tree rows need from the explorer around them. */
interface Explorer {
  activeId: string | null
  folders: ReadonlyArray<FolderRow>
  foldersIn: Map<string | null, Array<FolderRow>>
  filesIn: Map<string | null, Array<BrowserFile>>
  collapsed: ReadonlySet<string>
  toggle: (id: string) => void
  move: (id: string, folder: boolean, parentId: string | null) => void
  edit: (edit: Edit) => void
  newEntry: (kind: Edit['kind'], parentId: string | null) => void
  deleteFolder: (id: string) => void
  open: (id: string) => void
  run: (action: () => Promise<unknown>) => void
  rowMenu: (id: string) => {
    open: boolean
    onOpenChange: (open: boolean) => void
  }
  openRowMenu: (id: string) => (event: React.MouseEvent) => void
  drop: (parentId: string | null) => React.HTMLAttributes<HTMLElement>
  drag: (event: React.DragEvent, kind: string, id: string) => void
}

/** Open tab ids of each folder's files, by path. */
function tabsByRoot(files: ReadonlyArray<WorkspaceFile>) {
  const tabsByPath = new Map<string, Map<string, string>>()
  for (const file of files) {
    if (!file.location) continue
    const tabs = tabsByPath.get(file.location.rootId) ?? new Map()
    tabs.set(file.location.path, file.id)
    tabsByPath.set(file.location.rootId, tabs)
  }
  return tabsByPath
}

/** The folders down to `folderId`, opened. */
function expandTo(collapsed: ReadonlySet<string>, folderId: string | null) {
  const next = new Set(collapsed)
  const seen = new Set<string>()
  let id = folderId
  while (id && !seen.has(id)) {
    seen.add(id)
    next.delete(id)
    id = foldersCollection.get(id)?.parentId ?? null
  }
  return next
}

async function duplicateFile(id: string, parentId: string | null) {
  const file = filesCollection.get(id)
  if (!file) return
  const copy = createFile(file.name, file.content, file.profileId)
  if (file.zplSettings)
    await filesCollection.update(copy.id, (draft) => {
      draft.zplSettings = file.zplSettings
    }).isPersisted.promise
  await moveFile(copy.id, parentId)
  setActive(copy.id)
}

function downloadFile(id: string) {
  const file = filesCollection.get(id)
  if (file)
    downloadBlob(new Blob([file.content], { type: 'text/plain' }), file.name)
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
  // Tabs of open folders show in their own workspace, the rest in the browser's.
  const files = allFiles.filter(
    (file) =>
      !file.location ||
      !roots.some((root) => root.id === file.location?.rootId),
  )
  const tabsByPath = tabsByRoot(allFiles)
  const { data: folders } = useLiveQuery({
    queryKey: ['folders'],
    query: (q) =>
      q
        .from({ folder: foldersCollection })
        .orderBy(({ folder }) => folder.name, 'asc'),
  })
  // The tree by parent, built once rather than searched again per folder. A
  // file whose folder is gone shows at the top.
  const folderIds = new Set(folders.map((folder) => folder.id))
  // Files of a type the profile hides stay out, but for the one in the editor.
  const hiddenTypes = useHiddenTypes()
  const shownFiles = files.filter(
    (file) => file.id === activeId || !isHiddenType(hiddenTypes, file.name),
  )
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  // The row whose menu a right-click opened.
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [nameRequest, setNameRequest] = useState<NameRequest | null>(null)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
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
    setCollapsed((previous) => expandTo(previous, activeFile.folderId))
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
  const edit = (entry: Edit) => {
    const request = browserRequest(entry)
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
    edit({ kind, parentId, name: kind === 'file' ? m.file_untitled() : '' })
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
  const explorer: Explorer = {
    activeId,
    folders,
    foldersIn: groupBy(folders, (folder) => folder.parentId),
    filesIn: groupBy(
      [...shownFiles].sort((a, b) => a.name.localeCompare(b.name)),
      (file) =>
        file.folderId && folderIds.has(file.folderId) ? file.folderId : null,
    ),
    collapsed,
    toggle: (id) =>
      setCollapsed((previous) => {
        const next = new Set(previous)
        if (!next.delete(id)) next.add(id)
        return next
      }),
    move,
    edit,
    newEntry,
    deleteFolder: setDeleteId,
    open: (id) => {
      run(() => showFile(id))
      closeDrawer()
    },
    run,
    rowMenu: (id) => ({
      open: menuFor === id,
      onOpenChange: (open) => setMenuFor(open ? id : null),
    }),
    openRowMenu: (id) => (event) => {
      event.preventDefault()
      setMenuFor(id)
    },
    drop: (parentId) => ({
      onDragOver: (event) => {
        if (!event.dataTransfer.types.includes(ENTRY_DRAG)) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
        dragFeedback.over(event)
      },
      onDragLeave: dragFeedback.leave,
      onDrop: (event) => {
        dragFeedback.clear()
        const value = event.dataTransfer.getData(ENTRY_DRAG)
        if (!value) return
        event.preventDefault()
        event.stopPropagation()
        const [kind, id] = value.split(':')
        if (id) move(id, kind === 'folder', parentId)
      },
    }),
    drag: (event, kind, id) => {
      event.dataTransfer.setData(ENTRY_DRAG, `${kind}:${id}`)
      event.dataTransfer.effectAllowed = 'move'
      dragFeedback.start(event)
    },
  }
  const found = search
    ? shownFiles.filter((f) =>
        `${folderPath(f.folderId)}/${f.name}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
    : null
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
        <ExplorerHeader
          search={search}
          onSearch={setSearch}
          onNew={(kind) => newEntry(kind, null)}
          onImport={onImport}
          onImportFolder={() => directoryInput.current?.click()}
          onOpenFolder={() => run(openFolder)}
        />
        <SidebarContent
          className="px-2 pb-2 group-data-[collapsible=icon]:invisible"
          {...explorer.drop(null)}
        >
          <Collapsible open={browserOpen} onOpenChange={setBrowserOpen}>
            <WorkspaceHeader
              icon={<IconBrowser />}
              name={m.explorer_browser()}
              title={m.explorer_browser_hint()}
              open={browserOpen}
            >
              <BrowserActions
                count={shownFiles.length}
                onNew={(kind) => newEntry(kind, null)}
                onImport={onImport}
                onImportFolder={() => directoryInput.current?.click()}
              />
            </WorkspaceHeader>
            <CollapsibleContent className={nestClass} {...explorer.drop(null)}>
              {found ? (
                found.map((file) => (
                  <FileRow key={file.id} explorer={explorer} file={file} />
                ))
              ) : (
                <FolderTree explorer={explorer} parentId={null} />
              )}
              {files.length === 0 && folders.length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">
                  {m.explorer_empty()}
                </p>
              ) : null}
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
        <ExplorerFooter />
      </aside>
      {!isMobile ? <SidebarRail /> : null}
      <DeleteFolderDialog
        folderId={deleteId}
        files={files}
        onClose={() => setDeleteId(null)}
      />
      <Once shown={nameRequest !== null}>
        <NameDialog
          request={nameRequest}
          onClose={() => setNameRequest(null)}
        />
      </Once>
    </Sidebar>
  )
}

/** The sidebar's toggle, search field and New menu. */
function ExplorerHeader({
  search,
  onSearch,
  onNew,
  onImport,
  onImportFolder,
  onOpenFolder,
}: {
  search: string
  onSearch: (search: string) => void
  onNew: (kind: Edit['kind']) => void
  onImport: () => void
  onImportFolder: () => void
  onOpenFolder: () => void
}) {
  const sidebarRight = useSelector(editorPrefs, (s) => s.sidebarRight)
  const canOpenFolders = useCanOpenFolders()
  const { isMobile } = useSidebar()
  return (
    <SidebarHeader className="gap-2 group-data-[collapsible=icon]:items-center">
      {/* The toggle hugs the screen edge and stays put as the sidebar
          collapses: 3px of margin when open and 2px of top padding when
          collapsed match where the collapsed column centres it. */}
      <div className="flex items-center gap-1.5 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:pt-0.5">
        <SidebarTrigger
          className={cn(
            'shrink-0 text-muted-foreground max-md:size-11 group-data-[collapsible=icon]:m-0',
            sidebarRight
              ? 'order-last mr-[3px] group-data-[collapsible=icon]:order-first'
              : 'ml-[3px]',
          )}
        />
        {/* Collapsed, the search field and New menu are icons. */}
        <ToolbarButton
          label={m.palette_open()}
          shortcut={shortcuts.palette}
          size="icon-sm"
          className="hidden text-muted-foreground group-data-[collapsible=icon]:inline-flex"
          onClick={() => setPalette('commands')}
        >
          <IconSearch />
        </ToolbarButton>
        <InputGroup className="bg-background group-data-[collapsible=icon]:hidden">
          <InputGroupAddon>
            <IconSearch />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={m.explorer_search()}
            placeholder={m.explorer_search()}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
          {/* Phones have no ⌘K; their pane header has the search button. */}
          {!isMobile ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label={m.palette_open()}
                title={m.palette_placeholder()}
                onClick={() => setPalette('commands')}
              >
                <Kbd>{shortcutLabel(shortcuts.palette)}</Kbd>
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label={m.explorer_new()}
              className="shrink-0 aria-expanded:bg-muted group-data-[collapsible=icon]:hidden"
            >
              <IconPlus />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {m.explorer_in_browser()}
              </DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => onNew('file')}>
                <IconFilePlus />
                {m.file_new()}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onNew('folder')}>
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
                onSelect={onImportFolder}
              />
              {canOpenFolders ? (
                <MenuEntry
                  icon={<IconFolderRoot />}
                  label={m.folder_open()}
                  description={m.folder_open_desc()}
                  onSelect={onOpenFolder}
                />
              ) : null}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </SidebarHeader>
  )
}

/** The browser workspace's count, New buttons and ⋯ menu. */
function BrowserActions({
  count,
  onNew,
  onImport,
  onImportFolder,
}: {
  count: number
  onNew: (kind: Edit['kind']) => void
  onImport: () => void
  onImportFolder: () => void
}) {
  return (
    <>
      <RowCount count={count} />
      <RowAction
        label={m.file_new()}
        hint={m.explorer_in_browser()}
        onClick={() => onNew('file')}
      >
        <IconFilePlus />
      </RowAction>
      <RowAction
        label={m.explorer_new_folder()}
        hint={m.explorer_in_browser()}
        onClick={() => onNew('folder')}
      >
        <IconFolderPlus />
      </RowAction>
      <RowMenu label={m.folder_actions()}>
        <DropdownMenuItem onSelect={onImport}>
          <IconUpload />
          {m.explorer_import()}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onImportFolder}>
          <IconFolderUp />
          {m.explorer_import_folder()}
        </DropdownMenuItem>
        <HiddenTypesMenu />
      </RowMenu>
    </>
  )
}

/** The folders and files under `parentId`, each folder open or folded. */
function FolderTree({
  explorer,
  parentId,
  ancestors = new Set<string>(),
}: {
  explorer: Explorer
  parentId: string | null
  /** Folders above, so a loop in the data can't nest forever. */
  ancestors?: ReadonlySet<string>
}) {
  const { collapsed } = explorer
  return (
    <>
      {explorer.foldersIn
        .get(parentId)
        ?.filter((folder) => !ancestors.has(folder.id))
        .map((folder) => (
          <Collapsible
            key={folder.id}
            open={!collapsed.has(folder.id)}
            onOpenChange={() => explorer.toggle(folder.id)}
          >
            <div
              className={rowClass}
              {...explorer.drop(folder.id)}
              draggable
              onDragStart={(e) => explorer.drag(e, 'folder', folder.id)}
              onContextMenu={explorer.openRowMenu(folder.id)}
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
              <EntryMenu
                explorer={explorer}
                entry={{
                  kind: 'folder',
                  id: folder.id,
                  name: folder.name,
                  parentId,
                }}
              />
            </div>
            <CollapsibleContent
              className={nestClass}
              {...explorer.drop(folder.id)}
            >
              <FolderTree
                explorer={explorer}
                parentId={folder.id}
                ancestors={new Set([...ancestors, folder.id])}
              />
            </CollapsibleContent>
          </Collapsible>
        ))}
      {explorer.filesIn.get(parentId)?.map((file) => (
        <FileRow key={file.id} explorer={explorer} file={file} />
      ))}
    </>
  )
}

function FileRow({
  explorer,
  file,
}: {
  explorer: Explorer
  file: BrowserFile
}) {
  const active = file.id === explorer.activeId
  const entry = {
    kind: 'file' as const,
    id: file.id,
    parentId: file.folderId,
    name: file.name,
  }
  return (
    <div
      {...explorer.drop(file.folderId)}
      ref={active ? scrollToRow : undefined}
      className={cn(rowClass, active && activeRowClass)}
      draggable
      onDragStart={(e) => explorer.drag(e, 'file', file.id)}
      onContextMenu={explorer.openRowMenu(file.id)}
    >
      <Button
        variant="ghost"
        className={cn(
          rowButtonClass,
          active && 'font-medium',
          // Closed tabs stay listed, quieter than the open ones.
          file.closed && 'text-muted-foreground',
        )}
        aria-current={active ? 'page' : undefined}
        title={`${folderPath(file.folderId)} / ${file.name}`}
        onClick={() => explorer.open(file.id)}
        onDoubleClick={() => explorer.edit(entry)}
      >
        <FileIcon file={file} />
        <span className="truncate">{file.name}</span>
        <UnsavedMark fileId={file.id} />
      </Button>
      <EntryMenu
        explorer={explorer}
        entry={{ ...entry, closed: file.closed }}
      />
    </div>
  )
}

/** A row's ⋯ menu, also opened by right-clicking the row. */
function EntryMenu({
  explorer,
  entry,
}: {
  explorer: Explorer
  entry: Edit & { id: string }
}) {
  const folder = entry.kind === 'folder'
  return (
    <RowMenu
      label={folder ? m.explorer_folder_actions() : m.explorer_actions()}
      {...explorer.rowMenu(entry.id)}
    >
      <DropdownMenuItem onSelect={() => explorer.edit(entry)}>
        {m.file_rename()}
      </DropdownMenuItem>
      <MoveMenu explorer={explorer} entry={entry} />
      {folder || isMarkdownName(entry.name) ? (
        <DropdownMenuItem
          onSelect={() => exportMarkdownPdf({ kind: entry.kind, id: entry.id })}
        >
          {folder ? m.md_pdf_folder() : m.md_pdf_export()}
        </DropdownMenuItem>
      ) : null}
      {folder ? (
        <>
          <DropdownMenuItem
            onSelect={() => explorer.newEntry('file', entry.id)}
          >
            {m.file_new()}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => explorer.newEntry('folder', entry.id)}
          >
            {m.explorer_new_folder()}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => explorer.deleteFolder(entry.id)}>
            {m.explorer_delete_folder()}
          </DropdownMenuItem>
        </>
      ) : (
        <FileMenuItems explorer={explorer} entry={entry} />
      )}
    </RowMenu>
  )
}

/** "Move to": the browser's top level or any folder the entry can go in. */
function MoveMenu({
  explorer,
  entry,
}: {
  explorer: Explorer
  entry: Edit & { id: string }
}) {
  const folder = entry.kind === 'folder'
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>{m.explorer_move()}</DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
        <DropdownMenuItem
          disabled={!entry.parentId}
          onSelect={() => explorer.move(entry.id, folder, null)}
        >
          {m.explorer_browser()}
        </DropdownMenuItem>
        {explorer.folders
          .filter((f) => !folder || canMoveFolder(entry.id, f.id))
          .map((f) => (
            <DropdownMenuItem
              key={f.id}
              disabled={f.id === entry.parentId}
              onSelect={() => explorer.move(entry.id, folder, f.id)}
            >
              {folderPath(f.id)}
            </DropdownMenuItem>
          ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

function FileMenuItems({
  explorer,
  entry,
}: {
  explorer: Explorer
  entry: Edit & { id: string }
}) {
  return (
    <>
      <DropdownMenuItem
        onSelect={() =>
          explorer.run(() => duplicateFile(entry.id, entry.parentId))
        }
      >
        {m.explorer_duplicate()}
      </DropdownMenuItem>
      <HideTypeItem name={entry.name} />
      <DropdownMenuItem onSelect={() => downloadFile(entry.id)}>
        {m.explorer_download()}
      </DropdownMenuItem>
      {!entry.closed ? (
        <DropdownMenuItem onSelect={() => closeTab(entry.id)}>
          {m.tabs_close()}
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem
        variant="destructive"
        onSelect={() => askDelete(entry.id)}
      >
        {m.explorer_delete_file()}
      </DropdownMenuItem>
    </>
  )
}

function ExplorerFooter() {
  return (
    <SidebarFooter className="flex-row items-center gap-0.5 group-data-[collapsible=icon]:flex-col">
      <ArchiveButton />
      <SettingsButton />
      <Link
        to="/changelog"
        aria-label={m.app_version_label({ version: appVersion })}
        className="ml-auto rounded-md px-1.5 py-1 font-mono text-[11px] text-muted-foreground tabular-nums outline-none group-data-[collapsible=icon]:hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {m.app_version({ version: appVersion })}
      </Link>
    </SidebarFooter>
  )
}

/** Confirms deleting a folder with everything in it. */
function DeleteFolderDialog({
  folderId,
  files,
  onClose,
}: {
  folderId: string | null
  files: ReadonlyArray<BrowserFile>
  onClose: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const remove = () => {
    if (!folderId || deleting) return
    setDeleting(true)
    const ids = folderTreeIds(folderId)
    const children = files.filter(
      (file) => file.folderId && ids.has(file.folderId),
    )
    void deleteFolders(
      ids,
      children.map((file) => file.id),
    )
      .then(onClose)
      .catch(() => notify.error(m.explorer_failed()))
      .finally(() => setDeleting(false))
  }
  return (
    <Dialog
      open={!!folderId}
      onOpenChange={(open) => {
        if (!open && !deleting) onClose()
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
          <Button variant="outline" disabled={deleting} onClick={onClose}>
            {m.cancel()}
          </Button>
          <Button variant="destructive" disabled={deleting} onClick={remove}>
            {m.explorer_delete_folder()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
