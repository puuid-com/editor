import { defaultKeymap } from '@codemirror/commands'
import { Compartment, EditorState } from '@codemirror/state'
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  keymap,
  placeholder,
} from '@codemirror/view'
import { IconFolderOpen, IconFolderRoot } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'
import { useEffect, useRef } from 'react'

import { CommandMenuButton } from './CommandMenu'
import { openFolder } from './disk-workspace'
import { FILE_TYPES } from './file-type'
import {
  draftName,
  draftStore,
  holdDraftEdits,
  setDraftLanguage,
} from '#/components/editor/draft'
import { focusFileView } from '#/components/editor/editor-store'
import { editorGutters } from '#/components/editor/extensions'
import { structureGutters } from '#/components/editor/language'
import { editorTheme } from '#/components/editor/theme'
import { Button } from '#/components/ui/button'
import { Separator } from '#/components/ui/separator'
import { SidebarTrigger } from '#/components/ui/sidebar'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { useCanOpenFolders } from '#/hooks/use-can-open-folders'
import { LANGUAGE_EXTENSIONS } from '#/lib/languages'
import { shortcutLabel, shortcuts } from '#/lib/shortcuts'
import { createFile, saveContent } from '#/lib/store/files'
import { activeProfileId } from '#/lib/store/profiles'
import { setActive } from '#/lib/store/session'
import { m } from '#/paraglide/messages'
import type { DocLanguage } from '#/lib/document'

// Fixed-width records come from other systems rather than being typed, and
// read as such whatever the type, so they have no button.
const DRAFT_TYPES = FILE_TYPES.filter((type) => type.value !== 'flat')
const AUTO = 'auto'

/** The type's extension, as in `JSON` or `MD`. */
const shortType = (language: DocLanguage) =>
  LANGUAGE_EXTENSIONS[language][0].slice(1).toUpperCase()

let draftView: EditorView | null = null
const gutterCompartment = new Compartment()

function placeholderContent() {
  const hint = document.createElement('span')
  hint.className = 'opacity-60'
  hint.textContent = m.draft_hint({
    shortcut: shortcutLabel(shortcuts.palette),
  })
  const content = document.createElement('span')
  content.textContent = m.draft_placeholder()
  content.appendChild(document.createElement('br'))
  content.appendChild(hint)
  return content
}

/** Stops the browser's own save while nothing is there to save. */
const nothingToSave = () => true

/**
 * The editor when no tab is open: an untitled buffer, ready for typing. The
 * first edit makes it a file, in the type picked in the status bar.
 */
export function DraftPane() {
  const language = useSelector(draftStore, (s) => s.language)
  const parentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let fileId: string | null = null
    const view = new EditorView({
      parent: parentRef.current!,
      state: EditorState.create({
        extensions: [
          editorGutters(),
          gutterCompartment.of(structureGutters(draftStore.state.language)),
          drawSelection(),
          highlightActiveLine(),
          placeholder(placeholderContent()),
          editorTheme,
          EditorView.lineWrapping,
          keymap.of([
            { key: shortcuts.save.key, run: nothingToSave },
            { key: shortcuts.saveAs.key, run: nothingToSave },
            ...defaultKeymap,
          ]),
          // Dropped files open in tabs of their own, not as text in here.
          EditorView.domEventHandlers({
            drop: (event) => !!event.dataTransfer?.types.includes('Files'),
          }),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return
            const content = update.state.doc.toString()
            if (fileId) {
              saveContent({ id: fileId, content })
              holdDraftEdits(fileId, update)
              return
            }
            const name = draftName(draftStore.state.language)
            fileId = createFile(name, content, activeProfileId()).id
            holdDraftEdits(fileId, update)
            setActive(fileId)
            focusFileView(fileId)
          }),
        ],
      }),
    })
    draftView = view
    view.focus()
    return () => {
      draftView = null
      view.destroy()
      setDraftLanguage(null)
    }
  }, [])

  // Matches the gutters the file will get once the first edit makes it one.
  useEffect(() => {
    draftView?.dispatch({
      effects: gutterCompartment.reconfigure(structureGutters(language)),
    })
  }, [language])

  const name = draftName(language)
  return (
    <section aria-label={name} className="flex h-full min-w-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-0.5 border-b px-1.5 md:h-10">
        <SidebarTrigger className="shrink-0 text-muted-foreground max-md:size-11 md:hidden" />
        <span className="flex h-9 max-w-56 min-w-0 items-center rounded-md bg-muted px-2.5 text-xs font-medium text-foreground md:h-7">
          <span className="truncate">{name}</span>
        </span>
        <span className="flex-1" />
        <CommandMenuButton />
      </header>
      <div ref={parentRef} className="min-h-0 flex-1 overflow-hidden" />
    </section>
  )
}

/** The draft's type and the ways to open files instead, for the status bar. */
export function DraftControls({
  onOpenFromDisk,
}: {
  onOpenFromDisk: () => void
}) {
  const language = useSelector(draftStore, (s) => s.language)
  const canOpenFolders = useCanOpenFolders()
  return (
    <>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={0}
        aria-label={m.draft_type()}
        value={language ?? AUTO}
        onValueChange={(value) => {
          if (!value) return
          setDraftLanguage(value === AUTO ? null : (value as DocLanguage))
          draftView?.focus()
        }}
        // Phones have no room for it; what's pasted still sets the type.
        className="ml-1 shrink-0 max-md:hidden"
      >
        <ToggleGroupItem value={AUTO} className={ITEM}>
          {/* On the label, so the tooltip's state doesn't replace the item's. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{m.draft_type_auto()}</span>
            </TooltipTrigger>
            <TooltipContent>{m.draft_type_auto_hint()}</TooltipContent>
          </Tooltip>
        </ToggleGroupItem>
        {DRAFT_TYPES.map((type) => (
          <ToggleGroupItem
            key={type.value}
            value={type.value}
            aria-label={type.label()}
            className={ITEM}
          >
            {shortType(type.value)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Separator
        orientation="vertical"
        className="mx-1 data-vertical:h-4 data-vertical:self-center max-md:hidden"
      />
      <Button
        variant="ghost"
        size="xs"
        className="text-[11px] font-normal text-foreground max-md:h-11"
        onClick={onOpenFromDisk}
      >
        <IconFolderOpen />
        <span className="max-md:sr-only">{m.file_open_disk()}</span>
      </Button>
      {canOpenFolders && (
        <Button
          variant="ghost"
          size="xs"
          className="text-[11px] font-normal text-foreground max-md:h-11"
          onClick={() => void openFolder()}
        >
          <IconFolderRoot />
          <span className="max-md:sr-only">{m.folder_open_menu()}</span>
        </Button>
      )}
    </>
  )
}

const ITEM =
  'h-5 min-w-0 px-1.5 font-mono text-[10.5px] font-normal text-muted-foreground data-[state=on]:bg-foreground data-[state=on]:text-background'
