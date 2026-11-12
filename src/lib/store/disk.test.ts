import { beforeAll, describe, expect, it } from 'vitest'

import { diskStore, loadDiskLinks, loadNewDiskLinks, setDiskLink } from './disk'
import { workspaceReady } from './workspace'

beforeAll(() => workspaceReady())

// Plain objects stand in for handles: IndexedDB stores anything it can clone.
const handle = (name: string) =>
  ({ kind: 'file', name }) as unknown as FileSystemFileHandle

describe('links to files on disk', () => {
  it('keeps links across loads and drops those of missing files', async () => {
    await setDiskLink('a', {
      handle: handle('a.xml'),
      saved: '<a/>',
      modified: 1,
    })
    await setDiskLink('b', {
      handle: handle('b.xml'),
      saved: '<b/>',
      modified: 2,
    })
    diskStore.setState(() => ({}))

    await loadDiskLinks(new Set(['a']))
    expect(diskStore.state).toEqual({
      a: { handle: handle('a.xml'), saved: '<a/>', modified: 1 },
    })

    await loadDiskLinks(new Set(['a', 'b']))
    expect(Object.keys(diskStore.state)).toEqual(['a'])
  })

  it('takes in links made elsewhere without replacing its own', async () => {
    await setDiskLink('c', {
      handle: handle('c.xml'),
      saved: 'old',
      modified: 1,
    })
    await setDiskLink('d', {
      handle: handle('d.xml'),
      saved: '<d/>',
      modified: 1,
    })
    // As this page holds them: `c` newer than stored, `d` not known yet.
    diskStore.setState(() => ({
      c: { handle: handle('c.xml'), saved: 'new', modified: 2 },
    }))

    await loadNewDiskLinks(new Set(['c', 'd']))
    expect(diskStore.state.c?.saved).toBe('new')
    expect(diskStore.state.d?.saved).toBe('<d/>')

    // A link whose file this page doesn't have is left in storage.
    diskStore.setState(() => ({}))
    await loadNewDiskLinks(new Set(['c']))
    expect(Object.keys(diskStore.state)).toEqual(['c'])
    await loadNewDiskLinks(new Set(['c', 'd']))
    expect(Object.keys(diskStore.state).sort()).toEqual(['c', 'd'])
  })
})
