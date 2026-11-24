import {
  deleteByKey,
  executeTransaction,
  getByKey,
  openDatabase,
} from '@tanstack/react-db'

// The backup the recovery screen's Erase everything downloads, also kept in
// a database of its own that the erase leaves alone, so the editor can offer
// it back in one click once it reopens. `rescue.ts` writes it and can't
// import anything: keep these names in step with its `ERASED_*` constants.

const DATABASE_NAME = 'xml-editor-rescue'
const STORE = 'backups'
const KEY = 'erased'
/** How long the editor keeps offering it. */
const KEEP_MS = 7 * 24 * 60 * 60 * 1000

interface ErasedBackup {
  /** When it was taken, in milliseconds. */
  savedAt: number
  /** The backup file's text, as it downloaded. */
  text: string
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => T | Promise<T>,
) {
  const db = await openDatabase(DATABASE_NAME, 1, (upgrade) => {
    upgrade.createObjectStore(STORE)
  })
  try {
    return await executeTransaction(db, STORE, mode, (_, stores) =>
      run(stores[STORE]),
    )
  } finally {
    db.close()
  }
}

/** The backup taken before the last erase, while it is recent enough to offer. */
export async function erasedBackup(now = Date.now()) {
  if (typeof indexedDB === 'undefined') return null
  try {
    const kept = await withStore('readonly', (store) =>
      getByKey<ErasedBackup>(store, KEY),
    )
    if (!kept || typeof kept.text !== 'string') return null
    if (now - kept.savedAt > KEEP_MS) {
      await forgetErasedBackup()
      return null
    }
    return kept
  } catch (error) {
    console.error(
      'Could not read the backup kept by the recovery screen',
      error,
    )
    return null
  }
}

/** Drops it once restored or turned down. */
export async function forgetErasedBackup() {
  if (typeof indexedDB === 'undefined') return
  try {
    await withStore('readwrite', (store) => deleteByKey(store, KEY))
  } catch (error) {
    console.error(
      'Could not drop the backup kept by the recovery screen',
      error,
    )
  }
}
