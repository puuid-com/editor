import { describe, expect, it } from 'vitest'

import { ACCEPTED_TYPES, TEMPLATE_TYPES, survivor } from './files'

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
