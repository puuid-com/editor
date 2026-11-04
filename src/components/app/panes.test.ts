import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { sessionStore, setActive } from '#/lib/store/session'
import { createFile, filesCollection } from '#/lib/store/files'
import { settleWrites } from '#/lib/store/persist'
import { workspaceReady } from '#/lib/store/workspace'
import { movePaneTab, normalizePanes } from '#/lib/store/pane-layout'
import { hidePane, joinPanes, moveTab, openBeside, savePanes } from './panes'
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
    paneIds: [],
  }))
  await settleWrites()
})

const group = (id: string, fileIds: Array<string>, activeId = fileIds[0]) => ({
  id,
  fileIds,
  activeId,
})

describe('pane layout restoration', () => {
  it('migrates the old visible-file list and retains every background tab', () => {
    expect(
      normalizePanes(
        undefined,
        ['a', 'a', 'closed', 'b'],
        ['a', 'b', 'c'],
        'a',
      ),
    ).toEqual([group('a', ['a', 'c']), group('b', ['b'])])
  })
  it('drops closed and duplicate tabs without losing unassigned files', () => {
    expect(
      normalizePanes(
        [group('left', ['a', 'closed']), group('right', ['a', 'b'])],
        [],
        ['a', 'b', 'c'],
        'b',
      ),
    ).toEqual([group('left', ['a']), group('right', ['b', 'c'])])
  })
  it('restores pane order and selected files unchanged after reload', () => {
    const panes = [group('left', ['c', 'a'], 'a'), group('right', ['b'])]
    expect(
      normalizePanes(
        JSON.parse(JSON.stringify(panes)),
        [],
        ['a', 'b', 'c'],
        'b',
      ),
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
    ids.slice(1, 4).forEach(openBeside)
    openBeside(ids[4])
    expect(sessionStore.state.panes).toHaveLength(4)
    openBeside(ids[1])
    expect(sessionStore.state.activeId).toBe(ids[1])
    const before = sessionStore.state
    moveTab('missing', 'left')
    expect(sessionStore.state).toBe(before)
  })
})
