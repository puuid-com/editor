import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { sessionStore, setActive } from '#/lib/store/session'
import { createFile, filesCollection } from '#/lib/store/files'
import { settleWrites } from '#/lib/store/persist'
import { workspaceReady } from '#/lib/store/workspace'
import {
  dockPane,
  layoutPanes,
  movePaneTab,
  normalizeLayout,
  normalizePanes,
  paneNeighbor,
  removePane,
  swapPanes,
} from '#/lib/store/pane-layout'
import {
  dropPane,
  dropTab,
  hidePane,
  joinPanes,
  moveTab,
  openBeside,
  savePanes,
  saveSplitSizes,
  setZoomed,
  swapPane,
} from './panes'
import type { PaneLayout } from '#/lib/store/pane-layout'
import { closeTabs } from './files'

beforeAll(() => workspaceReady())
afterEach(() => settleWrites())
beforeEach(async () => {
  const ids = [...filesCollection.values()].map((f) => f.id)
  if (ids.length) filesCollection.delete(ids)
  sessionStore.setState((s) => ({
    ...s,
    activeId: null,
    panes: undefined,
    layout: undefined,
    zoomed: undefined,
  }))
  await settleWrites()
})

const group = (id: string, fileIds: Array<string>, activeId = fileIds[0]) => ({
  id,
  fileIds,
  activeId,
})

describe('pane layout restoration', () => {
  it('starts with every open file in one pane', () => {
    expect(normalizePanes(undefined, ['a', 'b', 'c'], 'b')).toEqual([
      group('b', ['a', 'b', 'c'], 'b'),
    ])
  })
  it('drops closed and duplicate tabs without losing unassigned files', () => {
    expect(
      normalizePanes(
        [group('left', ['a', 'closed']), group('right', ['a', 'b'])],
        ['a', 'b', 'c'],
        'b',
      ),
    ).toEqual([group('left', ['a']), group('right', ['b', 'c'])])
  })
  it('restores pane order and selected files unchanged after reload', () => {
    const panes = [group('left', ['c', 'a'], 'a'), group('right', ['b'])]
    expect(
      normalizePanes(structuredClone(panes), ['a', 'b', 'c'], 'b'),
    ).toEqual(panes)
  })
  it('moves and reorders tabs, removing an empty source pane', () => {
    const panes = [group('left', ['a', 'c']), group('right', ['b'])]
    const moved = movePaneTab(panes, 'c', 'right', 'b')
    expect(moved).toEqual([group('left', ['a']), group('right', ['c', 'b'])])
    expect(movePaneTab(moved, 'a', 'right')).toEqual([
      group('right', ['c', 'b', 'a'], 'a'),
    ])
    expect(movePaneTab(panes, 'c', 'left', 'a')[0].fileIds).toEqual(['c', 'a'])
    expect(panes[0].fileIds).toEqual(['a', 'c'])
  })
})

/** The arrangement without ids and sizes: `[a, [b, c]]` is a beside b over c. */
type Shape = string | Array<Shape>
function shape(layout: PaneLayout | undefined): Shape | undefined {
  if (!layout) return undefined
  return 'pane' in layout
    ? layout.pane
    : layout.children.map((child) => shape(child)!)
}
const direction = (layout: PaneLayout | undefined) =>
  layout && 'direction' in layout ? layout.direction : undefined
const sizes = (layout: PaneLayout | undefined) =>
  layout && 'sizes' in layout ? layout.sizes : undefined

describe('pane arrangement', () => {
  const row = normalizeLayout(undefined, ['a', 'b', 'c'])
  it('starts as one row and follows the panes that come and go', () => {
    expect(shape(row)).toEqual(['a', 'b', 'c'])
    expect(direction(row)).toBe('row')
    expect(shape(normalizeLayout(row, ['c', 'a', 'd']))).toEqual([
      'a',
      'c',
      'd',
    ])
    expect(normalizeLayout(row, ['b'])).toEqual({ pane: 'b' })
    expect(normalizeLayout(row, [])).toBeUndefined()
  })
  it('docks a pane on any edge, sharing the room of the one it lands on', () => {
    const below = dockPane(row, 'd', 'b', 'bottom')
    expect(shape(below)).toEqual(['a', ['b', 'd'], 'c'])
    expect(layoutPanes(below)).toEqual(['a', 'b', 'd', 'c'])
    const left = dockPane({ pane: 'a' }, 'b', 'a', 'left')
    expect(shape(left)).toEqual(['b', 'a'])
    expect(direction(left)).toBe('row')
    const sized = dockPane(
      { id: 's', direction: 'row', children: [{ pane: 'a' }, { pane: 'b' }] },
      'c',
      'a',
      'right',
    )
    expect(shape(sized)).toEqual(['a', 'c', 'b'])
    expect(sizes(sized)).toEqual({ a: 25, c: 25, b: 50 })
  })
  it('moves a pane already there, and gives its room back', () => {
    const grid = dockPane(dockPane(row, 'd', 'b', 'bottom'), 'a', 'd', 'right')
    expect(shape(grid)).toEqual([['b', ['d', 'a']], 'c'])
    expect(shape(removePane(grid, 'a'))).toEqual([['b', 'd'], 'c'])
    expect(shape(removePane(removePane(grid, 'a'), 'd'))).toEqual(['b', 'c'])
    expect(sizes(removePane(row, 'b'))).toEqual({ a: 50, c: 50 })
  })
  it('finds the pane on each side, and trades places with it', () => {
    const grid = dockPane(row, 'd', 'b', 'bottom')
    expect(paneNeighbor(grid, 'a', 'right')).toBe('b')
    expect(paneNeighbor(grid, 'd', 'top')).toBe('b')
    expect(paneNeighbor(grid, 'd', 'right')).toBe('c')
    expect(paneNeighbor(grid, 'c', 'left')).toBe('b')
    expect(paneNeighbor(grid, 'a', 'left')).toBeUndefined()
    expect(paneNeighbor(grid, 'a', 'bottom')).toBeUndefined()
    expect(shape(swapPanes(grid, 'a', 'd'))).toEqual(['d', ['b', 'a'], 'c'])
  })
})

describe('pane actions', () => {
  it('opens and switches files in their owning pane, and adds new files to the focused pane', () => {
    const [a, b, c] = ['a.xml', 'b.json', 'c.sql'].map(
      (name) => createFile(name).id,
    )
    savePanes([group('left', [a, c]), group('right', [b])], a)
    setActive(c)
    expect(sessionStore.state.panes?.map((p) => p.activeId)).toEqual([c, b])
    setActive(b)
    const d = createFile('new.xml').id
    setActive(d)
    expect(sessionStore.state.panes?.[1].fileIds).toEqual([b, d])
    expect(sessionStore.state.panes?.[0].activeId).toBe(c)
  })
  it('splits, moves, and merges groups without archiving files', () => {
    const [a, b, c] = ['a.xml', 'b.json', 'c.sql'].map(
      (name) => createFile(name).id,
    )
    savePanes([group('left', [a, b, c])], a)
    openBeside(b)
    const right = sessionStore.state.panes![1].id
    expect(sessionStore.state.panes?.map((p) => p.fileIds)).toEqual([
      [a, c],
      [b],
    ])
    moveTab(c, right)
    expect(sessionStore.state.panes?.map((p) => p.fileIds)).toEqual([
      [a],
      [b, c],
    ])
    hidePane(right)
    expect(sessionStore.state.panes).toEqual([group('left', [a, b, c], c)])
    expect(
      [a, b, c].every((id) => filesCollection.get(id)?.deletedAt === null),
    ).toBe(true)
  })
  it('joins every pane into the first, keeping order and the active file', () => {
    const [a, b, c, d] = ['a.xml', 'b.xml', 'c.xml', 'd.xml'].map(
      (name) => createFile(name).id,
    )
    savePanes(
      [group('left', [a, b]), group('mid', [c]), group('right', [d])],
      c,
    )
    joinPanes()
    expect(sessionStore.state.panes).toEqual([group('left', [a, b, c, d], c)])
    joinPanes()
    expect(sessionStore.state.panes).toEqual([group('left', [a, b, c, d], c)])
  })
  it('closes the selected tab onto a sibling in the same pane', async () => {
    const [a, b, c] = ['a.xml', 'b.xml', 'c.xml'].map(
      (name) => createFile(name).id,
    )
    savePanes([group('left', [a, c]), group('right', [b])], a)
    await closeTabs([a], [a, b, c])
    expect(sessionStore.state.activeId).toBe(c)
  })
  it('limits splits to four and ignores a stale drag payload', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'].map((name) => createFile(name).id)
    savePanes([group('left', ids)], ids[0])
    for (const id of ids.slice(1, 4)) openBeside(id)
    openBeside(ids[4])
    expect(sessionStore.state.panes).toHaveLength(4)
    openBeside(ids[1])
    expect(sessionStore.state.activeId).toBe(ids[1])
    const before = sessionStore.state
    moveTab('missing', 'left')
    expect(sessionStore.state).toBe(before)
  })
  it('drops a tab on an edge as a new pane, and a lone tab with its pane', () => {
    const [a, b, c] = ['a.xml', 'b.xml', 'c.xml'].map(
      (name) => createFile(name).id,
    )
    savePanes([group('left', [a, b, c])], a)
    dropTab(a, 'left', 'center')
    expect(sessionStore.state.panes).toHaveLength(1)
    dropTab(b, 'left', 'bottom')
    const lower = sessionStore.state.panes![1].id
    expect(sessionStore.state.panes?.map((p) => p.fileIds)).toEqual([
      [a, c],
      [b],
    ])
    expect(direction(sessionStore.state.layout)).toBe('column')
    // Its only tab: the pane itself moves, and no new one opens.
    dropTab(b, 'left', 'left')
    expect(sessionStore.state.panes?.map((p) => p.id)).toEqual([lower, 'left'])
    expect(direction(sessionStore.state.layout)).toBe('row')
    dropTab(b, lower, 'top')
    expect(sessionStore.state.panes).toHaveLength(2)
    dropTab(c, lower, 'center')
    expect(sessionStore.state.panes?.map((p) => p.fileIds)).toEqual([
      [b, c],
      [a],
    ])
  })
  it('moves, swaps, resizes and maximizes panes', () => {
    const [a, b, c] = ['a.xml', 'b.xml', 'c.xml'].map(
      (name) => createFile(name).id,
    )
    savePanes([group('one', [a]), group('two', [b]), group('three', [c])], a)
    dropPane('three', 'one', 'bottom')
    expect(shape(sessionStore.state.layout)).toEqual([['one', 'three'], 'two'])
    expect(sessionStore.state.panes?.map((p) => p.id)).toEqual([
      'one',
      'three',
      'two',
    ])
    swapPane('one', 'right')
    expect(shape(sessionStore.state.layout)).toEqual([['two', 'three'], 'one'])
    swapPane('one', 'right')
    expect(shape(sessionStore.state.layout)).toEqual([['two', 'three'], 'one'])
    const root = sessionStore.state.layout as { id: string }
    const column = (
      sessionStore.state.layout as { children: Array<{ id: string }> }
    ).children[0]
    saveSplitSizes(root.id, { [column.id]: 70, one: 30 })
    expect(sizes(sessionStore.state.layout)).toEqual({
      [column.id]: 70,
      one: 30,
    })
    setZoomed(true)
    dropPane('three', 'two', 'center')
    expect(sessionStore.state.panes?.map((p) => p.fileIds)).toEqual([
      [b, c],
      [a],
    ])
    expect(sessionStore.state.zoomed).toBe(true)
    hidePane('one')
    expect(sessionStore.state.panes).toEqual([group('two', [b, c, a], a)])
    expect(sessionStore.state.layout).toEqual({ pane: 'two' })
    expect(sessionStore.state.zoomed).toBe(false)
  })
  it('shows a new pane even when another was maximized', () => {
    const [a, b, c] = ['a.xml', 'b.xml', 'c.xml'].map(
      (name) => createFile(name).id,
    )
    savePanes([group('one', [a, b]), group('two', [c])], a)
    setZoomed(true)
    openBeside(b, 'bottom')
    expect(sessionStore.state.panes).toHaveLength(3)
    expect(sessionStore.state.zoomed).toBe(false)
  })
})
