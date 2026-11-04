import { describe, expect, it } from 'vitest'

import { splitOverflow } from './overflow'

const items = ['a', 'b', 'c', 'd', 'e', 'f']
const weights: Record<string, number> = { a: 1, b: 5, c: 0, d: 5, e: 9, f: 2 }

describe('splitOverflow', () => {
  it('shows everything when it fits', () => {
    expect(splitOverflow(['a', 'b'], 4, () => 0)).toEqual({
      shown: ['a', 'b'],
      hidden: [],
    })
  })

  it('keeps the heaviest items in their original order', () => {
    expect(splitOverflow(items, 3, (i) => weights[i])).toEqual({
      shown: ['b', 'd', 'e'],
      hidden: ['a', 'c', 'f'],
    })
  })

  it('breaks ties by position', () => {
    expect(splitOverflow(items, 2, () => 1).shown).toEqual(['a', 'b'])
  })

  it('always shows the kept item', () => {
    const { shown, hidden } = splitOverflow(
      items,
      3,
      (i) => weights[i],
      (i) => i === 'c',
    )
    expect(shown).toEqual(['b', 'c', 'e'])
    expect(hidden).toEqual(['a', 'd', 'f'])
  })
})
