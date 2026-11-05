import { describe, expect, it } from 'vitest'

import { occurrenceLabels } from './locate'

describe('occurrenceLabels', () => {
  it('shows only the step that differs', () => {
    expect(
      occurrenceLabels([
        '/Shipment[1]/ShipmentLines[1]/ShipmentLine[1]/LineNumber[1]',
        '/Shipment[1]/ShipmentLines[1]/ShipmentLine[2]/LineNumber[1]',
      ]),
    ).toEqual(['ShipmentLine[1]', 'ShipmentLine[2]'])
  })

  it('drops a [1] no sibling needs', () => {
    expect(
      occurrenceLabels([
        '/Order[1]/ShipFrom[1]/City[1]',
        '/Order[1]/ShipTo[1]/City[1]',
      ]),
    ).toEqual(['ShipFrom', 'ShipTo'])
  })

  it('marks shared layers before the element', () => {
    expect(
      occurrenceLabels([
        '/Shipment[1]/Line[1]/Detail[1]/LineNumber[1]',
        '/Shipment[1]/Line[2]/Detail[1]/LineNumber[1]',
      ]),
    ).toEqual(['Line[1]/[...]', 'Line[2]/[...]'])
  })

  it('marks shared layers between differences', () => {
    expect(
      occurrenceLabels([
        '/Batch[1]/Order[1]/Lines[1]/Line[1]/Sku[1]',
        '/Batch[1]/Order[2]/Lines[1]/Line[1]/Sku[1]',
        '/Batch[1]/Order[1]/Lines[1]/Line[2]/Sku[1]',
      ]),
    ).toEqual([
      'Order[1]/[...]/Line[1]',
      'Order[2]/[...]',
      'Order[1]/[...]/Line[2]',
    ])
  })

  it('names the nearest repeated element, not its container', () => {
    expect(
      occurrenceLabels([
        '/ManifestShipment[1]/ShipmentLines[1]/ShipmentLine[1]/ItemNumber[1]',
        '/ManifestShipment[1]/ShipmentLines[1]/ShipmentLine[2]/ItemNumber[1]',
        '/ManifestShipment[1]/Cartons[1]/Carton[1]/Contents[1]/Item[1]/ItemNumber[1]',
        '/ManifestShipment[1]/Cartons[1]/Carton[2]/Contents[1]/Item[1]/ItemNumber[1]',
      ]),
    ).toEqual([
      'ShipmentLine[1]',
      'ShipmentLine[2]',
      'Carton[1]/[...]',
      'Carton[2]/[...]',
    ])
  })

  it('keeps a container when the index alone would match another', () => {
    expect(
      occurrenceLabels([
        '/Root[1]/Lines[1]/Line[1]/Sku[1]',
        '/Root[1]/Lines[1]/Line[2]/Sku[1]',
        '/Root[1]/Credits[1]/Line[1]/Sku[1]',
      ]),
    ).toEqual(['Lines/Line[1]', 'Line[2]', 'Credits/[...]'])
  })

  it('names an unindexed branch when nothing below repeats', () => {
    expect(
      occurrenceLabels([
        '/Root[1]/Lines[1]/Line[1]/Sku[1]',
        '/Root[1]/Header[1]/Sku[1]',
      ]),
    ).toEqual(['Lines/[...]', 'Header'])
  })

  it('puts a JSON array index on its key', () => {
    const items = new Set(['/ShipmentLines[1]/0[1]', '/ShipmentLines[1]/1[1]'])
    expect(
      occurrenceLabels(
        [
          '/ShipmentLines[1]/0[1]/LineNumber[1]',
          '/ShipmentLines[1]/1[1]/LineNumber[1]',
        ],
        (path) => items.has(path),
      ),
    ).toEqual(['ShipmentLines[0]', 'ShipmentLines[1]'])
  })

  it('skips shared layers under a JSON array entry', () => {
    const items = new Set(['/lines[1]/0[1]', '/lines[1]/1[1]'])
    expect(
      occurrenceLabels(
        ['/lines[1]/0[1]/item[1]/sku[1]', '/lines[1]/1[1]/item[1]/sku[1]'],
        (path) => items.has(path),
      ),
    ).toEqual(['lines[0]/[...]', 'lines[1]/[...]'])
  })

  it('shows the own position when two share a parent', () => {
    expect(
      occurrenceLabels([
        '/Order[1]/Line[1]/Sku[1]',
        '/Order[1]/Line[1]/Sku[2]',
      ]),
    ).toEqual(['Sku[1]', 'Sku[2]'])
  })

  it('names the parent of one that sits higher', () => {
    expect(
      occurrenceLabels(['/Order[1]/Sku[1]', '/Order[1]/Line[1]/Sku[1]']),
    ).toEqual(['Order', 'Line'])
  })

  it('is empty without paths', () => {
    expect(occurrenceLabels([])).toEqual([])
  })
})
