import { describe, expect, it } from 'vitest'

import {
  base64ToBytes,
  bytesToBase64,
  fromBase64Url,
  toBase64Url,
} from './base64'

describe('base64', () => {
  it('encodes bytes as plain and URL-safe base64', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf, 0x66, 0x6f])
    expect(bytesToBase64(bytes)).toBe('+/+/Zm8=')
    expect(toBase64Url(bytes)).toBe('-_-_Zm8')
  })

  it('decodes both forms, with or without padding', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf, 0x66, 0x6f])
    expect(base64ToBytes('+/+/Zm8=')).toEqual(bytes)
    expect(base64ToBytes('+/+/Zm8')).toEqual(bytes)
    expect(fromBase64Url('-_-_Zm8')).toEqual(bytes)
  })

  it('round trips more bytes than one slice holds', () => {
    const bytes = Uint8Array.from({ length: 20_000 }, (_, i) => (i * 7) % 256)
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes)
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes)
  })

  it('throws on text that is not base64', () => {
    expect(() => base64ToBytes('not base64!')).toThrow()
  })
})
