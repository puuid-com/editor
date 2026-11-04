import { describe, expect, it } from 'vitest'

import { parentStep } from './locate'

describe('parentStep', () => {
  it('names the parent with its position', () => {
    expect(parentStep('/Invoice/Line[2]/Amount')).toBe('Line[2]')
  })

  it('drops a first position', () => {
    expect(parentStep('/Invoice/Line[1]/Amount')).toBe('Line')
  })

  it('is empty for a root element', () => {
    expect(parentStep('/Invoice')).toBe('')
  })
})
