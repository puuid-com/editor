import { describe, expect, it } from 'vitest'

import { parseXml } from './parse'
import { removePrefix, tagPrefixes } from './prefixes'

const apply = (text: string, prefix: string) => {
  const { changes, count } = removePrefix(parseXml(text).nodes, prefix)
  let out = text
  for (const c of [...changes].sort((a, b) => b.from - a.from))
    out = out.slice(0, c.from) + c.insert + out.slice(c.to)
  return { text: out, count }
}

const INPUT =
  '<s:Envelope xmlns:s="urn:s"><s:Body a:x="1">Hi <b:i>there</b:i></s:Body><s:E/></s:Envelope>'

describe('tagPrefixes', () => {
  it('counts the tags using each prefix', () => {
    expect(tagPrefixes(parseXml(INPUT).nodes)).toEqual([
      { prefix: 's', count: 3 },
      { prefix: 'b', count: 1 },
    ])
  })
})

describe('removePrefix', () => {
  it('drops only the given prefix from open and close tags', () => {
    expect(apply(INPUT, 's')).toEqual({
      text: '<Envelope xmlns:s="urn:s"><Body a:x="1">Hi <b:i>there</b:i></Body><E/></Envelope>',
      count: 3,
    })
  })

  it('leaves attribute prefixes alone', () => {
    expect(apply(INPUT, 'a')).toEqual({ text: INPUT, count: 0 })
  })
})
