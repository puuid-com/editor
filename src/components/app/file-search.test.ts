import { describe, expect, it } from 'vitest'

import { FILE_LIMIT, TOTAL_LIMIT, findInFiles } from './file-search'

const file = (id: string, content: string) => ({ id, name: id, content })

describe('find in open files', () => {
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
