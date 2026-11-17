import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import {
  FILE_LIMIT,
  TOTAL_LIMIT,
  findInFiles,
  searchWorkspace,
} from './file-search'
import { searchFolderQuery } from './search-folders'
import { fakeFolder } from '#/test/fake-fs'
import type { SearchReply } from './file-search'

const file = (id: string, content: string) => ({ id, name: id, content })

describe('file content matches', () => {
  it('groups literal matches and uses editor offsets for CRLF and CR files', () => {
    const results = findInFiles(
      [file('a.xml', 'İ\r\n<X.Y/>\r<x.y/>'), file('b.json', '{"x.y":1}')],
      'x.y',
      false,
    )
    expect(
      results.groups.map((g) => g.hits.map((h) => [h.from, h.line, h.text])),
    ).toEqual([
      [
        [3, 2, 'X.Y'],
        [10, 3, 'x.y'],
      ],
      [[2, 1, 'x.y']],
    ])
    expect(results.groups[0].hits[0]).toMatchObject({
      before: '<',
      after: '/>',
    })
  })

  it('honours case, whitespace and regexp punctuation', () => {
    const files = [file('a', 'a [a.*] [A.*]')]
    expect(findInFiles(files, ' [A.*]', true).groups[0].hits).toHaveLength(1)
    expect(findInFiles(files, '', false).groups).toEqual([])
    expect(findInFiles(files, 'absent', false).groups).toEqual([])
  })

  it('caps common matches and still includes later files', () => {
    const files = Array.from({ length: 8 }, (_, i) =>
      file(String(i), 'x'.repeat(FILE_LIMIT + 1)),
    )
    const results = findInFiles(files, 'x', true)
    expect(results.groups[0].hits).toHaveLength(FILE_LIMIT)
    expect(results.groups.flatMap((g) => g.hits)).toHaveLength(TOTAL_LIMIT)
    expect(results.limited).toBe(true)
    expect(
      findInFiles([file('a', 'x'.repeat(FILE_LIMIT))], 'x', true).limited,
    ).toBe(false)
  })
})

describe('workspace content search', () => {
  async function discover() {
    const { handle } = fakeFolder('Invoices', {
      '.obsidian': { 'app.json': '{"userIgnoreFilters":["archive/"]}' },
      archive: { 'ignored.xml': 'ticket' },
      'logo.png': 'ticket',
      'unreadable.txt': 'ticket',
      orders: { 'ledger.txt': 'order\r\nTicket' },
    })
    const client = new QueryClient()
    try {
      return await client.fetchQuery(
        searchFolderQuery({
          id: 'root',
          name: 'Invoices',
          access: 'granted',
          handle,
        }),
      )
    } finally {
      client.clear()
    }
  }

  it('searches unopened disk files, respects exclusions and preserves matches after a read failure', async () => {
    const { files: disk } = await discover()
    expect(disk.map((f) => f.name)).toEqual([
      'Invoices/unreadable.txt',
      'Invoices/orders/ledger.txt',
    ])
    vi.spyOn(disk[0].handle, 'getFile').mockRejectedValue(
      new Error('permission revoked'),
    )
    const replies: Array<SearchReply> = []
    await searchWorkspace(
      { files: [file('closed.xml', '<ticket/>')], disk },
      { query: 'ticket', matchCase: false },
      (reply) => replies.push(structuredClone(reply)),
      () => false,
    )
    expect(replies[0]).toMatchObject({
      pending: true,
      results: { groups: [{ id: 'closed.xml' }] },
    })
    expect(replies.at(-1)).toMatchObject({
      pending: false,
      skipped: true,
      results: {
        groups: [
          { id: 'closed.xml' },
          {
            name: 'Invoices/orders/ledger.txt',
            hits: [
              {
                line: 2,
                from: 6,
                text: 'Ticket',
                location: { rootId: 'root', path: 'orders/ledger.txt' },
              },
            ],
          },
        ],
      },
    })
  })

  it('drops obsolete disk results at the next batch', async () => {
    const { files: disk } = await discover()
    const send = vi.fn()
    await searchWorkspace(
      { files: [], disk },
      { query: 'ticket', matchCase: false },
      send,
      () => true,
    )
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].pending).toBe(true)
  })
})
