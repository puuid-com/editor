import { z } from 'zod'
import { filesCollection, settleContentSave } from './files'
import { localCollection, newId } from './persist'

export const folderSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable().default(null),
})
export const foldersCollection = localCollection('folders', folderSchema)

/** A folder and its descendants, with parents before children, even for cyclic records. */
export function folderTreeIds(id: string) {
  const children = new Map<string, Array<string>>()
  for (const folder of foldersCollection.values()) {
    if (!folder.parentId) continue
    const siblings = children.get(folder.parentId) ?? []
    siblings.push(folder.id)
    children.set(folder.parentId, siblings)
  }
  const ids = new Set([id])
  for (const parentId of ids) {
    for (const childId of children.get(parentId) ?? []) ids.add(childId)
  }
  return ids
}

export function validEntryName(name: string) {
  return (
    !!name.trim() &&
    !/[\\/]/.test(name) &&
    [...name].every((char) => char.charCodeAt(0) >= 32) &&
    !['.', '..'].includes(name.trim())
  )
}

export function folderPath(id: string | null): string {
  const parts: Array<string> = []
  const seen = new Set<string>()
  while (id && !seen.has(id)) {
    seen.add(id)
    const folder = foldersCollection.get(id)
    if (!folder) break
    parts.unshift(folder.name)
    id = folder.parentId
  }
  return parts.join('/')
}

export function canMoveFolder(id: string, parentId: string | null) {
  const seen = new Set([id])
  while (parentId) {
    if (seen.has(parentId)) return false
    seen.add(parentId)
    const parent = foldersCollection.get(parentId)
    if (!parent) return false
    parentId = parent.parentId
  }
  return true
}

export async function saveFolder(
  name: string,
  parentId: string | null,
  id?: string,
) {
  const trimmed = name.trim()
  if (
    !validEntryName(trimmed) ||
    (parentId && !foldersCollection.has(parentId))
  )
    return false
  if (id && (!foldersCollection.has(id) || !canMoveFolder(id, parentId)))
    return false
  if (
    [...foldersCollection.values()].some(
      (f) => f.id !== id && f.parentId === parentId && f.name === trimmed,
    )
  )
    return false
  const transaction = id
    ? foldersCollection.update(id, (draft) => {
        draft.name = trimmed
        draft.parentId = parentId
      })
    : foldersCollection.insert({ id: newId(), name: trimmed, parentId })
  await transaction.isPersisted.promise
  return true
}

export async function moveFile(id: string, folderId: string | null) {
  await settleContentSave()
  if (
    !filesCollection.has(id) ||
    (folderId && !foldersCollection.has(folderId))
  )
    return
  await filesCollection.update(id, (draft) => {
    draft.folderId = folderId
  }).isPersisted.promise
}

/** Only empty folders may be removed, so no file can be orphaned or lost. */
export async function deleteFolder(id: string) {
  if (
    [...foldersCollection.values()].some((f) => f.parentId === id) ||
    [...filesCollection.values()].some(
      (f) => f.folderId === id && f.deletedAt === null,
    )
  )
    return false
  if (!foldersCollection.has(id)) return false
  await settleContentSave()
  const archived = [...filesCollection.values()]
    .filter((f) => f.folderId === id)
    .map((f) => f.id)
  if (archived.length)
    await filesCollection.update(archived, (drafts) => {
      for (const draft of drafts) draft.folderId = null
    }).isPersisted.promise
  await foldersCollection.delete(id).isPersisted.promise
  return true
}
