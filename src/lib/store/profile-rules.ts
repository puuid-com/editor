import { defaultsCollection } from './defaults'
import { highlightsCollection } from './highlights'
import { pinsCollection } from './pins'
import { variablesCollection } from './variables'

// Rows that belong to a profile through their `profileId`: highlight, pin
// and default-value rules, and variables.

const RULE_COLLECTIONS = [
  highlightsCollection,
  pinsCollection,
  defaultsCollection,
] as const

interface OwnedRow {
  id: string
  profileId: string
  createdAt: number
}

/** A profile's rows of one collection, oldest first. */
export function ownedRows<T extends OwnedRow>(
  rows: Iterable<T>,
  profileId: string,
) {
  return [...rows]
    .filter((row) => row.profileId === profileId)
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
}

/**
 * Deletes a profile's rules, and its variables unless kept. Resolves once
 * every delete is stored.
 */
export async function deleteOwnedRows(
  profileId: string,
  { variables = true }: { variables?: boolean } = {},
) {
  const collections = variables
    ? [...RULE_COLLECTIONS, variablesCollection]
    : RULE_COLLECTIONS
  await Promise.all(
    collections.map((collection) => {
      const ids = [...collection.values()]
        .filter((row) => row.profileId === profileId)
        .map((row) => row.id)
      return ids.length ? collection.delete(ids).isPersisted.promise : undefined
    }),
  )
}
