import { describe, expect, it } from 'vitest'

import { occurrenceLabels } from './locate'

describe('occurrenceLabels', () => {
  it('names each parent with its position', () => {
    expect(
      occurrenceLabels([
        '/Order[1]/Line[1]/Sku[1]',
        '/Order[1]/Line[2]/Sku[1]',
        '/Order[1]/Line[3]/Sku[1]',
      ]),
    ).toEqual(['Line[1]', 'Line[2]', 'Line[3]'])
  })

  it('drops a [1] no sibling needs', () => {
    expect(
      occurrenceLabels([
        '/Order[1]/ShipFrom[1]/City[1]',
        '/Order[1]/ShipTo[1]/City[1]',
      ]),
    ).toEqual(['ShipFrom', 'ShipTo'])
  })

  it('goes up to where the paths part', () => {
    expect(
      occurrenceLabels([
        '/Batch[1]/Order[1]/Line[1]/Sku[1]',
        '/Batch[1]/Order[2]/Line[1]/Sku[1]',
      ]),
    ).toEqual(['Order[1]/Line', 'Order[2]/Line'])
  })

  it('keeps the parent when depths differ', () => {
    expect(
      occurrenceLabels(['/Order[1]/Sku[1]', '/Order[1]/Line[1]/Sku[1]']),
    ).toEqual(['Order', 'Order/Line'])
  })

  it('is empty without paths', () => {
    expect(occurrenceLabels([])).toEqual([])
  })

  it('adds the own step when two share a parent', () => {
    expect(
      occurrenceLabels([
        '/Order[1]/Line[1]/Sku[1]',
        '/Order[1]/Line[1]/Sku[2]',
      ]),
    ).toEqual(['Line/Sku[1]', 'Line/Sku[2]'])
  })
})
