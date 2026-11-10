import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import {
  ACCEPTED_TYPES,
  TEMPLATE_TYPES,
  closeTabs,
  importFiles,
  openFileIds,
  showFile,
  survivor,
} from './files'
import { createFile, filesCollection } from '#/lib/store/files'
import { settleWrites } from '#/lib/store/persist'
import { sessionStore, setActive } from '#/lib/store/session'
import { workspaceReady } from '#/lib/store/workspace'
import { encodeBase64 } from '#/lib/zpl/base64'

describe('survivor', () => {
  const open = ['a', 'b', 'c', 'd', 'e']

  it('prefers the nearest tab to the right that stays open', () => {
    expect(survivor(open, new Set(['b', 'c']), 'b')).toBe('d')
  })

  it('falls back to the left when everything to the right closes', () => {
    expect(survivor(open, new Set(['c', 'd', 'e']), 'd')).toBe('b')
  })

  it('returns nothing when every tab closes', () => {
    expect(survivor(open, new Set(open), 'c')).toBeUndefined()
  })
})

describe('file types', () => {
  it('lets every language the editor reads be opened', () => {
    const accepted = ACCEPTED_TYPES.split(',')
    for (const ext of ['.xml', '.json', '.ipynb', '.txt', '.sql', '.ddl'])
      expect(accepted).toContain(ext)
  })

  it('reads sort order templates only from XML and JSON', () => {
    const accepted = TEMPLATE_TYPES.split(',')
    expect(accepted).toContain('.xml')
    expect(accepted).toContain('.json')
    expect(accepted).not.toContain('.sql')
    expect(accepted).not.toContain('.txt')
  })
})

describe('importFiles', () => {
  beforeAll(() => workspaceReady())
  afterEach(() => settleWrites())

  it('opens each file in a tab, a base64 label decoded, and shows the last', async () => {
    const label = '^XA^FO50,50^FDHello^FS^XZ'
    await importFiles([
      new File(['<a/>'], 'a.xml'),
      new File([encodeBase64(label)], 'label.txt'),
    ])
    const byName = (name: string) =>
      [...filesCollection.values()].find((f) => f.name === name)
    expect(byName('a.xml')?.content).toBe('<a/>')
    expect(byName('label.txt')?.content).toBe(label)
    expect(sessionStore.state.activeId).toBe(byName('label.txt')?.id)
  })
})

describe('closing a browser tab', () => {
  beforeAll(() => workspaceReady())
  afterEach(() => settleWrites())

  it('keeps the file, and showing it gives its tab back at the end', async () => {
    const [a, b] = ['keep-a.xml', 'keep-b.xml'].map((name) =>
      createFile(name, '<a/>'),
    )
    setActive(a.id)
    await closeTabs([a.id], openFileIds())
    expect(filesCollection.get(a.id)).toMatchObject({
      deletedAt: null,
      closed: true,
      content: '<a/>',
    })
    expect(openFileIds()).not.toContain(a.id)
    expect(sessionStore.state.activeId).toBe(b.id)

    await showFile(a.id)
    expect(filesCollection.get(a.id)?.closed).toBe(false)
    expect(openFileIds().at(-1)).toBe(a.id)
    expect(sessionStore.state.activeId).toBe(a.id)
  })
})
