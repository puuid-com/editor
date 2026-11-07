import {
  IconChevronRight,
  IconFolder,
  IconFolderPlus,
  IconFilePlus,
  IconDots,
  IconLayoutSidebarRight,
  IconUpload,
  IconChevronDown,
  IconFolderUp,
} from '@tabler/icons-react'
import { useLiveQuery } from '@tanstack/react-db'
import { useForm } from '@tanstack/react-form'
import { useRef, useState } from 'react'
import { useMediaQuery } from '#/hooks/use-media-query'
import { importFiles, closeTabs } from './files'
import { FileIcon } from './FileIcon'
import { ToolbarButton } from './ToolbarButton'
import { askClose } from './ui-store'
import { notify } from './notice-store'
import { UnsavedMark } from './UnsavedMark'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '#/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '#/components/ui/dialog'
import { useOpenFiles } from '#/hooks/use-files'
import { createFile, filesCollection, renameFile } from '#/lib/store/files'
import {
  foldersCollection,
  saveFolder,
  moveFile,
  deleteFolder,
  canMoveFolder,
  folderPath,
  validEntryName,
} from '#/lib/store/folders'
import { activeProfileId } from '#/lib/store/profiles'
import { setActive } from '#/lib/store/session'
import { downloadBlob } from '#/lib/file-io'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

/** A tree row owns its hover and selected colors; the buttons inside stay flat. */
const rowClass =
  'group/row flex min-w-0 items-center text-muted-foreground hover:bg-muted/60 hover:text-foreground has-[[aria-haspopup=menu][aria-expanded=true]]:bg-muted/60 has-[[aria-haspopup=menu][aria-expanded=true]]:text-foreground'
const rowButtonClass =
  'h-8 min-w-0 flex-1 justify-start px-2 font-normal hover:bg-transparent hover:text-inherit aria-expanded:bg-transparent aria-expanded:text-inherit dark:hover:bg-transparent'

type Edit = {
  kind: 'file' | 'folder'
  id?: string
  parentId: string | null
  name: string
}

export function FileExplorer({
  activeId,
  onImport,
}: {
  activeId: string | null
  onImport: () => void
}) {
  const files = useOpenFiles()
  const { data: folders } = useLiveQuery((q) =>
    q
      .from({ folder: foldersCollection })
      .orderBy(({ folder }) => folder.name, 'asc'),
  )
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<Edit | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
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
          {m.explorer_root()}
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          label={
            entry.kind === 'folder'
              ? m.explorer_folder_actions()
              : m.explorer_actions()
          }
          className="mr-1 shrink-0 hover:bg-foreground/10 aria-expanded:bg-foreground/10 dark:hover:bg-foreground/10 md:opacity-0 md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100 md:aria-expanded:opacity-100"
        >
          <IconDots />
        </ToolbarButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setEdit(entry)}>
          {m.file_rename()}
        </DropdownMenuItem>
        {destinations(entry.id, entry.kind === 'folder', entry.parentId)}
        {entry.kind === 'folder' ? (
          <>
            <DropdownMenuItem
              onSelect={() =>
                setEdit({
                  kind: 'file',
                  parentId: entry.id,
                  name: m.file_untitled(),
                })
              }
            >
              {m.file_new()}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                setEdit({ kind: 'folder', parentId: entry.id, name: '' })
              }
            >
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
                  const copy = createFile(
                    file.name,
                    file.content,
                    file.profileId,
                  )
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
      </DropdownMenuContent>
    </DropdownMenu>
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
      className={cn(
        rowClass,
        file.id === activeId && 'bg-muted text-foreground hover:bg-muted',
      )}
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
          onClick={() => setVisible(!visible)}
        >
          <IconLayoutSidebarRight />
        </ToolbarButton>
        {visible && (
          <>
            <span className="min-w-0 flex-1 text-xs font-medium">
              {m.explorer_title()}
            </span>
            <ToolbarButton
              label={m.file_new()}
              onClick={() =>
                setEdit({
                  kind: 'file',
                  parentId: null,
                  name: m.file_untitled(),
                })
              }
            >
              <IconFilePlus />
            </ToolbarButton>
            <ToolbarButton
              label={m.explorer_new_folder()}
              onClick={() =>
                setEdit({ kind: 'folder', parentId: null, name: '' })
              }
            >
              <IconFolderPlus />
            </ToolbarButton>
            <ToolbarButton label={m.explorer_import()} onClick={onImport}>
              <IconUpload />
            </ToolbarButton>
            <ToolbarButton
              label={m.explorer_import_folder()}
              onClick={() => directoryInput.current?.click()}
            >
              <IconFolderUp />
            </ToolbarButton>
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
            <Button
              variant="ghost"
              className="mb-1 w-full justify-start text-xs text-muted-foreground"
              onClick={() =>
                setCollapsed(
                  collapsed.size
                    ? new Set()
                    : new Set(folders.map((f) => f.id)),
                )
              }
            >
              {m.explorer_root()}
              <span className="ml-auto tabular-nums">{files.length}</span>
            </Button>
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
      <Dialog
        open={!!edit}
        onOpenChange={(open) => {
          if (!open) setEdit(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          {edit && (
            <EntryForm
              key={`${edit.kind}:${edit.id ?? edit.parentId}`}
              edit={edit}
              done={() => {
                setEdit(null)
                setCollapsed(new Set())
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </aside>
  )
}

function EntryForm({ edit, done }: { edit: Edit; done: () => void }) {
  const [error, setError] = useState(false)
  const form = useForm({
    defaultValues: { name: edit.name },
    onSubmit: async ({ value }) => {
      setError(false)
      try {
        if (edit.kind === 'folder') {
          if (!(await saveFolder(value.name, edit.parentId, edit.id))) {
            setError(true)
            return
          }
        } else if (edit.id)
          await renameFile(edit.id, value.name)?.isPersisted.promise
        else {
          const file = createFile(value.name.trim(), '', activeProfileId())
          await moveFile(file.id, edit.parentId)
          setActive(file.id)
        }
        done()
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
        <DialogTitle>
          {edit.id
            ? m.file_rename()
            : edit.kind === 'folder'
              ? m.explorer_new_folder()
              : m.file_new()}
        </DialogTitle>
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
