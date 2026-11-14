import { describe, expect, it } from 'vitest'

import { elementAt, elementByPath, occurrenceLabels } from './locate'
import { parseXml } from './parse'
import { parseJson } from '#/lib/json/parse'

describe('elementAt', () => {
  const text = '<r><a>1</a>x<b/><c><d>2</d></c></r>'
  const { nodes } = parseXml(text)
  const at = (pos: number) => elementAt(nodes, pos)?.name ?? null

  it('finds the deepest element holding the cursor', () => {
    expect(at(text.indexOf('2'))).toBe('d')
    expect(at(text.indexOf('<c>'))).toBe('c')
    expect(at(0)).toBe('r')
  })

  it('gives a cursor right after a close tag to that element', () => {
    // After `</a>`, where text starts, and after `<b/>`, where `<c>` starts.
    expect(at(text.indexOf('x'))).toBe('a')
    expect(at(text.indexOf('<c>'))).toBe('c')
    expect(at(text.length)).toBe('r')
  })

  it('searches long sibling lists', () => {
    const items = Array.from({ length: 500 }, (_, i) => `<i>${i}</i>`)
    const long = `<r>${items.join('\n')}</r>`
    const doc = parseXml(long)
    const pos = long.indexOf('<i>321</i>') + 4
    expect(elementAt(doc.nodes, pos)?.path).toBe('/r[1]/i[322]')
  })

  it('finds JSON members', () => {
    const json = '{"a": 1, "b": {"c": [true, false]}}'
    const doc = parseJson(json)
    expect(elementAt(doc.nodes, json.indexOf('false'))?.path).toBe(
      '/b[1]/c[1]/1[1]',
    )
  })
})

describe('elementByPath', () => {
  it('finds elements and JSON keys holding a slash', () => {
    const xml = parseXml('<r><a/><a><b/></a></r>')
    expect(elementByPath(xml.nodes, '/r[1]/a[2]/b[1]')?.name).toBe('b')
    expect(elementByPath(xml.nodes, '/r[1]/a[3]')).toBeNull()
    expect(elementByPath(xml.nodes, '')).toBeNull()
    const json = parseJson('{"a/b": {"c": 1}}')
    expect(elementByPath(json.nodes, '/a%2Fb[1]/c[1]')?.name).toBe('c')
  })
})

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
