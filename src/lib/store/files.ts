import {
  createPacedMutations,
  createTransaction,
  debounceStrategy,
} from '@tanstack/react-db'
import { z } from 'zod'

import {
  DEFAULT_PROFILE_ID,
  localCollection,
  newId,
  withDefaultProfile,
} from './persist'
import { writerId } from './session'
import type { LabelSettings } from '#/lib/zpl/settings'
import { labelSettingsSchema } from '#/lib/zpl/schema'

export const fileSchema = z.object({
  id: z.string(),
  name: z.string(),
  folderId: z.string().nullable().default(null),
  content: z.string(),
  /** Tab order. */
  order: z.number(),
  /** Browser tab that wrote the content last, to tell remote edits apart. */
  writer: z.string(),
  /** Null while open; otherwise retained in the deleted-file archive. */
  deletedAt: z.number().nullable().default(null),
  /** A browser file without a tab: still listed in the explorer to reopen. */
  closed: z.boolean().default(false),
  /** Profile whose settings apply while this file is open. */
  profileId: z.string().default(DEFAULT_PROFILE_ID),
  zplSettings: labelSettingsSchema.optional(),
  /** Where the file lives in a folder opened from disk, if it does. */
  location: z
    .object({
      rootId: z.string(),
      /** From the folder, with `/` between names. */
      path: z.string(),
    })
    .optional(),
})

export type XmlFile = z.infer<typeof fileSchema>
export type FileLocation = NonNullable<XmlFile['location']>
export const ARCHIVE_LIMIT = 10

export const filesCollection = localCollection('files', fileSchema, {
  // Closed tabs of the oldest versions were dropped rather than archived.
  upgrade: (row) => (row.open === false ? null : withDefaultProfile(row)),
})

/** Whether a file has a tab open, as opposed to closed or deleted. */
export function isOpen(file: XmlFile | undefined) {
  return file?.deletedAt === null && !file.closed
}

/** Ids of the open tabs, in tab order. */
export function openFileIds() {
  return [...filesCollection.values()]
    .filter(isOpen)
    .sort((a, b) => a.order - b.order)
    .map((file) => file.id)
}

export function archivedFiles() {
  return [...filesCollection.values()]
    .filter((file) => file.deletedAt !== null)
    .sort((a, b) => b.deletedAt! - a.deletedAt! || a.id.localeCompare(b.id))
}

function nextOrder() {
  let max = 0
  for (const file of filesCollection.values()) {
    max = Math.max(max, file.order)
  }
  return max + 1
}

/**
 * Picks `untitled.xml`, `untitled-2.xml`… avoiding names of open tabs kept
 * in the browser. Files of a folder on disk keep the name they have there.
 */
export function uniqueName(base: string) {
  const taken = new Set(
    [...filesCollection.values()]
      .filter((file) => file.deletedAt === null && !file.location)
      .map((file) => file.name),
  )
  if (!taken.has(base)) return base
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot) : ''
  for (let i = 2; ; i++) {
    const candidate = `${stem}-${i}${ext}`
    if (!taken.has(candidate)) return candidate
  }
}

/** Adds a file with a tab of its own, after the others. */
function openFile(
  fields: Pick<XmlFile, 'name' | 'content' | 'profileId' | 'location'>,
): XmlFile {
  const file: XmlFile = {
    id: newId(),
    folderId: null,
    order: nextOrder(),
    writer: writerId,
    deletedAt: null,
    closed: false,
    ...fields,
  }
  filesCollection.insert(file)
  return file
}

export function createFile(
  name: string,
  content = '',
  profileId = DEFAULT_PROFILE_ID,
) {
  return openFile({ name: uniqueName(name), content, profileId })
}

/** The last name of a path whose names `/` separates. */
function baseName(path: string) {
  return path.slice(path.lastIndexOf('/') + 1)
}

/** Opens a file of a folder on disk in a tab, under its name there. */
export function createDiskFile(
  location: FileLocation,
  content: string,
  profileId: string,
) {
  return openFile({
    name: baseName(location.path),
    content,
    profileId,
    location,
  })
}

/** The open tab of a file in a folder on disk, if there is one. */
export function fileAt(rootId: string, path: string) {
  for (const file of filesCollection.values()) {
    if (
      file.deletedAt === null &&
      file.location?.rootId === rootId &&
      file.location.path === path
    )
      return file
  }
}

/**
 * Moves a tab to where its file now is on disk, such as after a rename, or
 * with no location, keeps it in the browser only.
 */
export async function relocateFile(
  id: string,
  location: FileLocation | undefined,
) {
  // Like archiveFile: a pending content save would write the old place back.
  await drainContentSaves()
  if (!filesCollection.has(id)) return
  await filesCollection.update(id, (draft) => {
    if (!location) {
      delete draft.location
      return
    }
    draft.location = location
    draft.name = baseName(location.path)
  }).isPersisted.promise
}

/**
 * Closes tabs in one write, so a batch leaves the strip at once rather than
 * tab by tab. `drop` are files whose text is safe on disk: they go. The rest
 * stay in the explorer, in the browser only.
 */
export async function closeFiles(
  hide: ReadonlyArray<string>,
  drop: ReadonlyArray<string> = [],
) {
  // Like archiveFile: a pending content save would reopen the tabs.
  await drainContentSaves()
  const hideIds = [...new Set(hide)].filter((id) =>
    isOpen(filesCollection.get(id)),
  )
  const dropIds = [...new Set(drop)].filter((id) => filesCollection.has(id))
  if (!hideIds.length && !dropIds.length) return
  const transaction = createTransaction({
    mutationFn: async ({ transaction: tx }) => {
      await filesCollection.utils.acceptMutations(tx)
    },
  })
  transaction.mutate(() => {
    if (hideIds.length)
      filesCollection.update(hideIds, (drafts) => {
        for (const draft of drafts) {
          draft.closed = true
          delete draft.location
        }
      })
    if (dropIds.length) filesCollection.delete(dropIds)
  })
  await transaction.isPersisted.promise
}

/** Gives a closed browser file its tab back, at the end. */
export async function reopenFile(id: string) {
  const file = filesCollection.get(id)
  if (!file || file.deletedAt !== null || !file.closed) return
  const order = nextOrder()
  await filesCollection.update(id, (draft) => {
    draft.closed = false
    draft.order = order
  }).isPersisted.promise
}

/** Archive and evict in one storage write, so failure rolls back both changes. */
export function archiveFile(id: string) {
  return archiveFiles([id])
}

/**
 * Archives files in one write, the last of `ids` as the newest, and evicts
 * what falls past the archive's limit.
 */
export async function archiveFiles(ids: ReadonlyArray<string>) {
  // A paced save carries a full record snapshot. Let it settle first so it
  // cannot overwrite deletedAt and reopen these files after the archive write.
  await drainContentSaves()
  const live = [...new Set(ids)].filter(
    (id) => filesCollection.get(id)?.deletedAt === null,
  )
  if (!live.length) return
  const archived = archivedFiles()
  // Keep deletion order stable even for several closes in the same millisecond.
  const first = Math.max(Date.now(), (archived[0]?.deletedAt ?? 0) + 1)
  const newest = [...live].reverse()
  const expired = new Set([
    ...newest.slice(ARCHIVE_LIMIT),
    ...archived
      .slice(Math.max(ARCHIVE_LIMIT - live.length, 0))
      .map((entry) => entry.id),
  ])
  const kept = live.filter((id) => !expired.has(id))
  const stamp = new Map(live.map((id, index) => [id, first + index]))
  const archiveTransaction = createTransaction({
    mutationFn: async ({ transaction }) => {
      await filesCollection.utils.acceptMutations(transaction)
    },
  })
  archiveTransaction.mutate(() => {
    if (kept.length)
      filesCollection.update(kept, (drafts) => {
        for (const draft of drafts) draft.deletedAt = stamp.get(draft.id)!
      })
    if (expired.size) filesCollection.delete([...expired])
  })
  await archiveTransaction.isPersisted.promise
}

/** Restore at the end of the open tabs without overwriting an existing name. */
export async function restoreFile(id: string) {
  const file = filesCollection.get(id)
  if (!file || file.deletedAt === null) return
  const name = uniqueName(file.name)
  const order = nextOrder()
  await filesCollection.update(id, (draft) => {
    draft.name = name
    draft.order = order
    draft.deletedAt = null
    draft.closed = false
    draft.writer = writerId
  }).isPersisted.promise
  return id
}

export function renameFile(id: string, name: string) {
  const trimmed = name.trim()
  if (!trimmed || !filesCollection.has(id)) return
  return updateMetadata(() =>
    filesCollection.update(id, (draft) => {
      draft.name = trimmed
    }),
  )
}

/** Switches the profile, and so the settings, a file uses. */
export async function setFileProfile(id: string, profileId: string) {
  // Like archiveFile: a pending content save would write the old profile back.
  await drainContentSaves()
  const file = filesCollection.get(id)
  if (!file || file.profileId === profileId) return
  await filesCollection.update(id, (draft) => {
    draft.profileId = profileId
  }).isPersisted.promise
}

/** Moves every file of one profile, archived ones included, to another. */
export async function reassignProfile(fromId: string, toId: string) {
  await drainContentSaves()
  const ids = [...filesCollection.values()]
    .filter((file) => file.profileId === fromId)
    .map((file) => file.id)
  if (ids.length === 0) return
  await filesCollection.update(ids, (drafts) => {
    for (const draft of drafts) draft.profileId = toId
  }).isPersisted.promise
}

/**
 * Debounced file edits: metadata changes join any pending content save, so
 * its full-record snapshot cannot undo a rename or label settings change.
 */
const pacedSaveFile = createPacedMutations<() => void>({
  onMutate: (mutate) => mutate(),
  mutationFn: async ({ transaction }) => {
    await filesCollection.utils.acceptMutations(transaction)
  },
  strategy: debounceStrategy({ wait: 400 }),
})

let pendingContentSave: Promise<unknown> | undefined

/** New edits can queue another paced transaction while an earlier one writes. */
async function drainContentSaves(ignoreFailures = false) {
  while (pendingContentSave) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    await pendingContentSave.catch((error: unknown) => {
      if (!ignoreFailures) throw error
    })
  }
}

/** Resolves once every pending file edit has finished or failed. */
export function settleContentSave() {
  return drainContentSaves(true)
}

/** Whether a failed write hit the browser's storage quota. */
export function isStorageFull(error: unknown): boolean {
  if (!(error instanceof Error) && !(error instanceof DOMException)) {
    return false
  }
  // Transactions may wrap the browser's error, keeping its name in the message.
  return (
    error.name === 'QuotaExceededError' ||
    error.message.includes('QuotaExceededError') ||
    isStorageFull((error as Error).cause)
  )
}

function saveFile(mutate: () => void) {
  const transaction = pacedSaveFile(mutate)
  const pending = transaction.isPersisted.promise
  pendingContentSave = pending
  const clear = () => {
    if (pendingContentSave === pending) pendingContentSave = undefined
  }
  // Failures reach `onSaveFailed` through the collection's storage.
  void pending.then(clear, clear)
  return transaction
}

/** Metadata still persists immediately when there is no paced save to join. */
function updateMetadata(
  mutate: () => ReturnType<typeof filesCollection.update>,
) {
  return pendingContentSave ? saveFile(mutate) : mutate()
}

export function saveContent({ id, content }: { id: string; content: string }) {
  return saveFile(() => {
    if (filesCollection.get(id)?.deletedAt !== null) return
    filesCollection.update(id, (draft) => {
      draft.content = content
      draft.writer = writerId
    })
  })
}

export function saveZplSettings(id: string, settings: LabelSettings) {
  if (!filesCollection.has(id)) return
  return updateMetadata(() =>
    filesCollection.update(id, (draft) => {
      draft.zplSettings = settings
    }),
  )
}
