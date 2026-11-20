import { diff } from '@codemirror/merge'
import { describe, expect, it } from 'vitest'

import { compareTexts } from './compare'

const options = { removeEmptyLines: true, sort: 'none' as const }

describe('compareTexts', () => {
  it('keeps both sides as written by default', () => {
    const a = { name: 'a.xml', content: '<r><a>1</a></r>' }
    const b = { name: 'b.xml', content: '<r>\n  <a>1</a>\n</r>' }
    expect(compareTexts(a, b, false, options)).toEqual({
      a: a.content,
      b: b.content,
      formatted: false,
      unparsed: null,
    })
  })

  it('shows no differences for the same XML formatted differently', () => {
    const a = { name: 'a.xml', content: '<r><a  x="1"/><b>t</b></r>' }
    const b = {
      name: 'b.xml',
      content: '<r>\n\n    <a x="1" />\n\t<b>t</b>\n</r>\n',
    }
    const result = compareTexts(a, b, true, options)
    expect(result.formatted).toBe(true)
    expect(result.a).toBe(result.b)
    expect(diff(result.a, result.b)).toEqual([])
  })

  it('shows no differences for the same JSON formatted differently', () => {
    const a = { name: 'a.json', content: '{"a":1,"b":[1,2]}' }
    const b = { name: 'b.json', content: '{\n "a" : 1,\n "b" : [ 1, 2 ]\n}' }
    const result = compareTexts(a, b, true, options)
    expect(result.a).toBe(result.b)
  })

  it('still marks real changes once formatted', () => {
    const a = { name: 'a.xml', content: '<r><a>1</a><b>2</b></r>' }
    const b = { name: 'b.xml', content: '<r>\n  <a>1</a>\n  <b>3</b>\n</r>' }
    const result = compareTexts(a, b, true, options)
    const changes = diff(result.a, result.b)
    expect(changes).toHaveLength(1)
    const [change] = changes
    expect(result.a.slice(change.fromA, change.toA)).toBe('2')
    expect(result.b.slice(change.fromB, change.toB)).toBe('3')
  })

  it('formats with the given options', () => {
    const a = { name: 'a.xml', content: '<r><b>1</b><a>2</a></r>' }
    const b = { name: 'b.xml', content: '<r><a>2</a><b>1</b></r>' }
    expect(compareTexts(a, b, true, options).a).not.toBe(
      compareTexts(a, b, true, options).b,
    )
    const sorted = compareTexts(a, b, true, { ...options, sort: 'asc' })
    expect(sorted.a).toBe(sorted.b)
  })

  it('falls back to the raw texts when a side does not parse', () => {
    const a = { name: 'a.xml', content: '<r><a>1</a></r>' }
    const b = { name: 'broken.xml', content: '<r><a>1</r>' }
    expect(compareTexts(a, b, true, options)).toEqual({
      a: a.content,
      b: b.content,
      formatted: false,
      unparsed: 'broken.xml',
    })
  })
})
