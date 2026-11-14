import { describe, expect, it } from 'vitest'

import { panelEdge } from './panel-side'

describe('side panel position', () => {
  it('goes beside the code when there is room, under it otherwise', () => {
    expect(panelEdge('auto', { roomy: true })).toBe('right')
    expect(panelEdge('auto', { roomy: false })).toBe('bottom')
    expect(panelEdge('auto', { roomy: true, wideContent: true })).toBe('bottom')
    expect(panelEdge('auto', { roomy: false, above: true })).toBe('top')
  })
  it('stays where it was put, whatever the room', () => {
    expect(panelEdge('left', { roomy: false })).toBe('left')
    expect(panelEdge('top', { roomy: true, wideContent: true })).toBe('top')
  })
  it('only stacks on a phone', () => {
    expect(panelEdge('left', { roomy: false, phone: true })).toBe('top')
    expect(panelEdge('right', { roomy: false, phone: true })).toBe('bottom')
    expect(panelEdge('top', { roomy: false, phone: true })).toBe('top')
    expect(panelEdge('auto', { roomy: true, phone: true })).toBe('bottom')
    expect(panelEdge('auto', { roomy: true, phone: true, above: true })).toBe(
      'top',
    )
  })
})
