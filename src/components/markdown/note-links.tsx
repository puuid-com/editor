import { useQuery } from '@tanstack/react-query'
import { useSelector } from '@tanstack/react-store'
import { createContext, useContext, useEffect, useState } from 'react'
import type { ComponentProps, MouseEvent, ReactNode } from 'react'

import {
  allFilesQuery,
  blobQuery,
  textQuery,
} from '#/components/app/disk-queries'
import { openDiskFile } from '#/components/app/disk-workspace'
import { isEditableName } from '#/lib/disk-tree'
import type { DiskEntry } from '#/lib/disk-tree'
import { useFileContent, useOpenFiles } from '#/hooks/use-files'
import {
  embedSize,
  hrefPath,
  isImagePath,
  isLocalHref,
  isMarkdownName,
  linkResolver,
  noteSection,
} from '#/lib/obsidian'
import { rootsStore } from '#/lib/store/disk'
import type { DiskRoot } from '#/lib/store/disk'
import type { FileLocation } from '#/lib/store/files'
import { m } from '#/paraglide/messages'

// Links and images in a note of a folder opened from disk point at the
// folder's other files, as in an Obsidian vault: `[[links]]` and relative
// links open the note in a tab, `![[embeds]]` and relative images show the
// image from disk, and `![[note]]` shows that note's text.

/** The note the preview shows, and how to find what it links to. */
interface Note {
  root: DiskRoot
  path: string
  /** The folder's file a link or image in the note points at. */
  find: (target: string) => DiskEntry | undefined
  /** Another note of the same folder, whose links start from it. */
  at: (path: string) => Note
}

const NoteContext = createContext<Note | null>(null)

/** The notes embedding the one shown, outermost first. */
const EmbeddingNotes = createContext<ReadonlyArray<string>>([])

/** How many notes deep embeds go, which also stops notes embedding each other. */
const MAX_EMBED_DEPTH = 4

/** Lets links and images in the preview find the folder's files. */
export function NoteProvider({
  location,
  children,
}: {
  location: FileLocation | undefined
  children: ReactNode
}) {
  const root = useSelector(rootsStore, (roots) =>
    roots.find((candidate) => candidate.id === location?.rootId),
  )
  if (!location || root?.access !== 'granted') return children
  return (
    <FolderNote root={root} path={location.path}>
      {children}
    </FolderNote>
  )
}

function FolderNote({
  root,
  path,
  children,
}: {
  root: DiskRoot
  path: string
  children: ReactNode
}) {
  const { data: files = [], isPending, isError } = useQuery(allFilesQuery(root))
  const resolve = linkResolver(files.map((file) => file.path))
  const byPath = new Map(files.map((file) => [file.path, file]))
  const noteAt = (from: string): Note => ({
    root,
    path: from,
    find: (target) => byPath.get(resolve(target, from) ?? ''),
    at: noteAt,
  })
  const note = noteAt(path)
  return (
    <NoteContext value={note}>
      <span
        className="contents"
        data-pdf-state={isError ? 'error' : isPending ? 'pending' : 'ready'}
      >
        {children}
      </span>
    </NoteContext>
  )
}

/** Scrolls the preview to the heading that reads `heading`. */
function scrollToHeading(event: MouseEvent<HTMLElement>, heading: string) {
  event.preventDefault()
  const wanted = heading.trim().toLowerCase()
  const match = [
    ...(event.currentTarget
      .closest('article')
      ?.querySelectorAll('h1, h2, h3, h4, h5, h6') ?? []),
  ].find((element) => element.textContent.trim().toLowerCase() === wanted)
  match?.scrollIntoView({ block: 'start' })
}

/** A link to nothing in the folder, faded as Obsidian shows one. */
function MissingLink({
  name,
  children,
}: {
  name?: string
  children: ReactNode
}) {
  return (
    <span
      className="text-muted-foreground underline decoration-dotted underline-offset-2"
      title={name ? m.md_link_missing({ name }) : undefined}
    >
      {children}
    </span>
  )
}

/** A link that opens one of the folder's files in a tab. */
function FileLink({
  note,
  entry,
  heading,
  children,
}: {
  note: Note
  entry: DiskEntry
  heading?: string
  children: ReactNode
}) {
  // Images and such open nowhere in the editor.
  if (!isEditableName(entry.name)) return <span>{children}</span>
  return (
    <a
      href={encodeURI(entry.path)}
      title={entry.path}
      data-note-path={entry.path}
      data-note-heading={heading}
      onClick={(event) => {
        if (entry.path === note.path && heading) {
          scrollToHeading(event, heading)
          return
        }
        event.preventDefault()
        void openDiskFile(note.root, entry)
      }}
    >
      {children}
    </a>
  )
}

/** `[[target#heading|alias]]`. */
export function WikiLink({
  target = '',
  heading,
  children,
}: {
  target?: string
  heading?: string
  children?: ReactNode
}) {
  const note = useContext(NoteContext)
  if (!target && heading) {
    return (
      <a
        href="#"
        data-note-heading={heading}
        onClick={(event) => scrollToHeading(event, heading)}
      >
        {children}
      </a>
    )
  }
  const entry = note?.find(target)
  if (!note || !entry)
    return (
      <MissingLink name={note ? target : undefined}>{children}</MissingLink>
    )
  return (
    <FileLink note={note} entry={entry} heading={heading}>
      {children}
    </FileLink>
  )
}

/** `![[image.png|300]]` shows the image; an embedded note links to it. */
export function WikiEmbed({
  target = '',
  heading,
  alias,
  children,
}: {
  target?: string
  heading?: string
  alias?: string
  children?: ReactNode
}) {
  const note = useContext(NoteContext)
  const entry = target ? note?.find(target) : undefined
  if (note && entry && isImagePath(entry.path)) {
    const size = embedSize(alias)
    return (
      <DiskImage
        root={note.root}
        entry={entry}
        alt={size ? entry.name : (alias ?? entry.name)}
        {...size}
      />
    )
  }
  return (
    <WikiLink target={target} heading={heading}>
      {children}
    </WikiLink>
  )
}

/**
 * The note `![[target]]` embeds, or nothing when it isn't a note of the
 * folder, or showing it would loop back to a note it is already inside.
 */
export function useNoteEmbed(target: string) {
  const note = useContext(NoteContext)
  const above = useContext(EmbeddingNotes)
  const entry = target ? note?.find(target) : undefined
  if (!note || !entry || !isMarkdownName(entry.name)) return undefined
  if (
    entry.path === note.path ||
    above.includes(entry.path) ||
    above.length >= MAX_EMBED_DEPTH
  )
    return undefined
  return { note, entry }
}

/** A note's text: its latest edits when open in a tab, else as saved on disk. */
function useNoteText(root: DiskRoot, entry: DiskEntry) {
  const open = useOpenFiles().find(
    (file) =>
      file.location?.rootId === root.id && file.location.path === entry.path,
  )
  const live = useFileContent(open?.id ?? '')
  const disk = useQuery({
    ...textQuery(root, entry.path, entry.handle as FileSystemFileHandle),
    enabled: !open,
  })
  if (open) return { text: live?.content, isError: false }
  return { text: disk.data, isError: disk.isError }
}

/**
 * `![[note#heading]]`: the note's text, or the part it names, ruled off and
 * titled with a link to the note. `children` draws it, with the note's own
 * links starting from where it sits in the folder.
 */
export function EmbeddedNote({
  note,
  entry,
  heading,
  children,
}: {
  note: Note
  entry: DiskEntry
  heading?: string
  children: (source: string) => ReactNode
}) {
  const above = useContext(EmbeddingNotes)
  const { text, isError } = useNoteText(note.root, entry)
  const name = entry.name.replace(/\.(md|markdown)$/i, '')
  const label = heading ? `${name} > ${heading.replace(/^\^/, '')}` : name
  if (isError)
    return (
      <p data-pdf-state="error">
        <MissingLink name={entry.path}>{label}</MissingLink>
      </p>
    )
  if (text === undefined) return <p data-pdf-state="pending" />
  const section = noteSection(text, heading)
  if (section === null)
    return (
      <p>
        <MissingLink name={`${entry.path}#${heading}`}>{label}</MissingLink>
      </p>
    )
  return (
    <div data-note-embed className="my-5 border-l-2 pl-4">
      <div className="not-prose mb-2 truncate text-xs text-muted-foreground [&_a]:underline-offset-2 [&_a:hover]:underline">
        <FileLink note={note} entry={entry} heading={heading}>
          {label}
        </FileLink>
      </div>
      <div className="[&>:first-child]:mt-0 [&>:last-child]:mb-0">
        <EmbeddingNotes value={[...above, note.path]}>
          <NoteContext value={note.at(entry.path)}>
            {children(section)}
          </NoteContext>
        </EmbeddingNotes>
      </div>
    </div>
  )
}

/**
 * A Markdown link: `#section` scrolls the preview, a file beside the note
 * opens in a tab, and a site opens in a new browser tab.
 */
export function PreviewLink({ href = '', ...props }: ComponentProps<'a'>) {
  const note = useContext(NoteContext)
  if (href.startsWith('#')) {
    return (
      <a
        {...props}
        href={href}
        onClick={(event) => {
          event.preventDefault()
          event.currentTarget
            .closest('article')
            ?.querySelector(`[id="${CSS.escape(headingId(href))}"]`)
            ?.scrollIntoView({ block: 'start' })
        }}
      />
    )
  }
  if (note && isLocalHref(href)) {
    const entry = note.find(hrefPath(href))
    return entry ? (
      <FileLink
        note={note}
        entry={entry}
        heading={
          href.includes('#')
            ? headingId(href.slice(href.indexOf('#')))
            : undefined
        }
      >
        {props.children}
      </FileLink>
    ) : (
      <MissingLink name={hrefPath(href)}>{props.children}</MissingLink>
    )
  }
  return <a {...props} href={href} target="_blank" rel="noopener noreferrer" />
}

/** The id a `#section` link points at, as written if it isn't valid URL encoding. */
function headingId(href: string) {
  const id = href.slice(1)
  try {
    return decodeURIComponent(id)
  } catch {
    return id
  }
}

/** A Markdown image, read from the folder when it is a file beside the note. */
export function PreviewImage({
  src,
  alt = '',
  ...props
}: ComponentProps<'img'>) {
  const note = useContext(NoteContext)
  const entry =
    note && typeof src === 'string' && isLocalHref(src)
      ? note.find(hrefPath(src))
      : undefined
  if (note && entry)
    return (
      <DiskImage root={note.root} entry={entry} alt={alt} title={props.title} />
    )
  return <img {...props} src={src} alt={alt} />
}

/** An object URL for `blob`, let go once it changes or nothing shows it. */
function useObjectUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) return
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return blob ? url : undefined
}

function DiskImage({
  root,
  entry,
  alt,
  title,
  width,
  height,
}: {
  root: DiskRoot
  entry: DiskEntry
  alt: string
  title?: string
  width?: number
  height?: number
}) {
  const { data, isError } = useQuery(
    blobQuery(root, entry.path, entry.handle as FileSystemFileHandle),
  )
  const url = useObjectUrl(data)
  if (isError)
    return (
      <span data-pdf-state="error">
        <MissingLink name={entry.path}>{alt}</MissingLink>
      </span>
    )
  if (!url) return <span data-pdf-state="pending" />
  return <img src={url} alt={alt} title={title} width={width} height={height} />
}
