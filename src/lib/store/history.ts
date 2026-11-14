import type { Store } from '@tanstack/store'

import { singleton } from './singleton'

// One undo timeline for the whole editor. Text edits stay in each file's
// CodeMirror history; this keeps a marker for each of them, in order with
// every other change people make: pins, colours, profiles, defaults,
// variables, renames, preferences. Undo takes back the latest of those, so
// ⌘Z after pinning a tag unpins it, wherever the focus is.
//
// Changes to the stores below are recorded on their own: what one action
// writes, up to its last storage write, becomes one step. Synced changes
// from other browser tabs don't go through these methods, so they never
// land in this tab's history.

type Row = { id: string } & Record<string, unknown>

/** The collection methods history watches and replays changes through. */
interface HistoryCollection {
  has: (id: string) => boolean
  get: (id: string) => object | undefined
  values: () => Iterable<object>
  insert: (...args: Array<never>) => unknown
  update: (...args: Array<never>) => unknown
  delete: (...args: Array<never>) => unknown
}

interface CollectionOptions {
  /** Whether adding and removing rows is undoable, not only edits. */
  rows?: boolean
  /** The fields an edit of `row` can take back; all of them by default. */
  fields?: (row: Row) => ReadonlyArray<string>
  /** Fields that never count, such as ones the app keeps up by itself. */
  ignore?: ReadonlyArray<string>
}

interface WatchedCollection extends Required<
  Omit<CollectionOptions, 'fields'>
> {
  collection: HistoryCollection
  fields?: (row: Row) => ReadonlyArray<string>
}

interface WatchedStore {
  store: Store<object>
  set: (state: object) => void
}

interface RowChange {
  source: WatchedCollection
  id: string
  before?: Row
  after?: Row
  /** For an edit, the fields it changed. */
  fields: ReadonlyArray<string>
}

interface StoreChange {
  source: WatchedStore
  before: object
  after: object
}

/** Undo and redo for changes made outside the stores, such as the theme. */
export interface CustomStep {
  undo: () => void
  redo: () => void
}

type Entry =
  | { kind: 'text'; fileId: string }
  | {
      kind: 'data'
      rows: Array<RowChange>
      stores: Array<StoreChange>
      custom: Array<CustomStep>
    }

/** The file editor a step of text history belongs to, as undo sees it. */
export interface TextHistory {
  fileId: string | null
  undo: () => boolean
  redo: () => boolean
}

interface Group {
  rows: Map<WatchedCollection, Map<string, Row>>
  stores: Map<WatchedStore, object>
  custom: Array<CustomStep>
  /** Where the step goes, so text typed meanwhile stays after it. */
  index: number
  touches: number
}

const LIMIT = 500

interface HistoryState {
  undo: Array<Entry>
  redo: Array<Entry>
  group: Group | null
  /** Replaying a step, or making changes that aren't the user's. */
  quiet: number
  settle: () => Promise<unknown>
  collections: Array<WatchedCollection>
}

const state = singleton('history', (): HistoryState => ({
  undo: [],
  redo: [],
  group: null,
  quiet: 0,
  settle: () => Promise.resolve(),
  collections: [],
}))

/** What to wait for before an action counts as finished: its storage writes. */
export function setHistorySettle(settle: () => Promise<unknown>) {
  state.settle = settle
}

/** Runs `run` without recording what it changes, such as automatic upkeep. */
export function withoutHistory<T>(run: () => T): T {
  state.quiet++
  try {
    return run()
  } finally {
    state.quiet--
  }
}

function openGroup() {
  if (state.group) return state.group
  const group: Group = {
    rows: new Map(),
    stores: new Map(),
    custom: [],
    index: state.undo.length,
    touches: 0,
  }
  state.group = group
  void closeLater(group)
  return group
}

// An action is over once its writes are stored and nothing more happened in
// the meantime, so an action that awaits its first write before the next one,
// like deleting a profile, still makes one step.
async function closeLater(group: Group) {
  let seen = -1
  while (state.group === group && seen !== group.touches) {
    seen = group.touches
    await new Promise((resolve) => setTimeout(resolve, 0))
    await state.settle().catch(() => undefined)
  }
  if (state.group === group) flushHistory()
}

function snapshot(source: WatchedCollection) {
  const rows = new Map<string, Row>()
  for (const row of source.collection.values()) {
    rows.set((row as Row).id, row as Row)
  }
  return rows
}

function touchCollection(source: WatchedCollection) {
  if (state.quiet) return
  const group = openGroup()
  group.touches++
  if (!group.rows.has(source)) group.rows.set(source, snapshot(source))
}

/**
 * Records adding, editing and removing rows of `collection` in the undo
 * history. Returns the collection.
 */
export function watchCollection<T extends HistoryCollection>(
  collection: T,
  { rows = true, fields, ignore = [] }: CollectionOptions = {},
) {
  const source: WatchedCollection = { collection, rows, fields, ignore }
  state.collections.push(source)
  for (const method of ['insert', 'update', 'delete'] as const) {
    const original = collection[method].bind(collection) as (
      ...args: Array<unknown>
    ) => unknown
    Object.assign(collection, {
      [method]: (...args: Array<unknown>) => {
        touchCollection(source)
        return original(...args)
      },
    })
  }
  return collection
}

/** Records changes to `store` in the undo history. Returns the store. */
export function watchStore<T extends object>(store: Store<T>) {
  const set = store.setState.bind(store)
  const source: WatchedStore = {
    store,
    set: (next) => set(() => next as T),
  }
  store.setState = (updater) => {
    if (!state.quiet) {
      const group = openGroup()
      group.touches++
      if (!group.stores.has(source)) group.stores.set(source, store.state)
    }
    set(updater)
  }
  return store
}

/** Adds a change made outside the stores to the step being recorded. */
export function recordStep(step: CustomStep) {
  if (state.quiet) return
  const group = openGroup()
  group.touches++
  group.custom.push(step)
}

function same(a: unknown, b: unknown) {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}

/** The fields an edit between `a` and `b` can take back. */
function editable(source: WatchedCollection, a: Row, b: Row) {
  if (source.fields) {
    // Both sides decide: a file that moved to disk keeps its name there.
    const other = source.fields(b)
    return source.fields(a).filter((k) => other.includes(k))
  }
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(
    (k) => k !== 'id' && !k.startsWith('$') && !source.ignore.includes(k),
  )
}

function rowChanges(source: WatchedCollection, before: Map<string, Row>) {
  const after = snapshot(source)
  const out: Array<RowChange> = []
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const old = before.get(id)
    const now = after.get(id)
    if (old === now) continue
    if (!old || !now) {
      if (source.rows)
        out.push({ source, id, before: old, after: now, fields: [] })
      continue
    }
    const fields = editable(source, old, now).filter(
      (k) => !same(old[k], now[k]),
    )
    if (fields.length) out.push({ source, id, before: old, after: now, fields })
  }
  return out
}

/** Ends the step being recorded now instead of when its writes finish. */
export function flushHistory() {
  const group = state.group
  if (!group) return
  state.group = null
  const rows = [...group.rows].flatMap(([source, before]) =>
    rowChanges(source, before),
  )
  const stores = [...group.stores].flatMap(([source, before]) =>
    same(before, source.store.state)
      ? []
      : [{ source, before, after: source.store.state }],
  )
  if (!rows.length && !stores.length && !group.custom.length) return
  const entry: Entry = { kind: 'data', rows, stores, custom: group.custom }
  state.undo.splice(Math.min(group.index, state.undo.length), 0, entry)
  state.redo = []
  trim()
}

function trim() {
  if (state.undo.length > LIMIT) state.undo.splice(0, state.undo.length - LIMIT)
}

/**
 * Notes a text edit in a file. `steps` is how many undo steps its editor
 * gained, none when the edit joined the step before.
 */
export function recordTextEdit(fileId: string, steps: number) {
  for (let i = 0; i < steps; i++) state.undo.push({ kind: 'text', fileId })
  state.redo = []
  trim()
}

function plain(row: Row) {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !key.startsWith('$')),
  )
}

function applyRow(change: RowChange, target: Row | undefined) {
  const { collection } = change.source
  const run = collection as unknown as {
    insert: (row: object) => unknown
    update: (id: string, edit: (draft: Row) => void) => unknown
    delete: (id: string) => unknown
  }
  if (!target) {
    if (collection.has(change.id)) run.delete(change.id)
    return
  }
  if (!collection.has(change.id)) {
    run.insert(plain(target))
    return
  }
  if (!change.fields.length) {
    // A row added back over one another tab made meanwhile.
    const current = collection.get(change.id) as Row
    const fields = editable(change.source, current, target)
    run.update(change.id, (draft) => assign(draft, target, fields))
    return
  }
  run.update(change.id, (draft) => assign(draft, target, change.fields))
}

function assign(draft: Row, target: Row, fields: Iterable<string>) {
  for (const key of fields) {
    if (key in target) draft[key] = structuredClone(target[key])
    else delete draft[key]
  }
}

function apply(entry: Entry & { kind: 'data' }, direction: 'undo' | 'redo') {
  withoutHistory(() => {
    const rows = direction === 'undo' ? [...entry.rows].reverse() : entry.rows
    for (const change of rows)
      applyRow(change, direction === 'undo' ? change.before : change.after)
    for (const change of entry.stores)
      change.source.set(direction === 'undo' ? change.before : change.after)
    const custom =
      direction === 'undo' ? [...entry.custom].reverse() : entry.custom
    for (const step of custom) step[direction]()
  })
}

function move(direction: 'undo' | 'redo', text: TextHistory | null) {
  flushHistory()
  const from = direction === 'undo' ? state.undo : state.redo
  const to = direction === 'undo' ? state.redo : state.undo
  for (let i = from.length - 1; i >= 0; i--) {
    const entry = from[i]
    if (entry.kind === 'text') {
      // Another file's edits wait until that file is open again.
      if (!text || entry.fileId !== text.fileId) continue
      from.splice(i, 1)
      // Its editor may have dropped the step, such as past its depth.
      if (!text[direction]()) continue
      to.push(entry)
      return true
    }
    from.splice(i, 1)
    apply(entry, direction)
    to.push(entry)
    return true
  }
  // Text history made where this page couldn't see it, as in a closed file.
  return text ? text[direction]() : false
}

/** Takes back the latest change, in the open file's text or anywhere else. */
export function undoStep(text: TextHistory | null) {
  return move('undo', text)
}

/** Makes the last undone change again. */
export function redoStep(text: TextHistory | null) {
  return move('redo', text)
}

/** Whether undo and redo have something to do, besides the editor's own. */
export function historyDepths(fileId: string | null) {
  const count = (entries: Array<Entry>) =>
    entries.filter((e) => e.kind === 'data' || e.fileId === fileId).length
  return {
    undo: count(state.undo) + (state.group ? 1 : 0),
    redo: count(state.redo),
  }
}

/** Forgets every step, for tests. */
export function resetHistory() {
  state.undo = []
  state.redo = []
  state.group = null
}
