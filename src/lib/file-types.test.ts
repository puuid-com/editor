import { describe, expect, it } from 'vitest'

import { fileTypeOf, isHiddenType } from './file-types'

describe('fileTypeOf', () => {
  it('takes the last extension, lowercase', () => {
    expect(fileTypeOf('order.XML')).toBe('xml')
    expect(fileTypeOf('archive.tar.gz')).toBe('gz')
  })

  it('has none for bare names and dotfiles', () => {
    expect(fileTypeOf('README')).toBeNull()
    expect(fileTypeOf('.env')).toBeNull()
    expect(fileTypeOf('notes.')).toBeNull()
  })
})

describe('isHiddenType', () => {
  it('matches names of a hidden type whatever their case', () => {
    expect(isHiddenType(['json'], 'Data.JSON')).toBe(true)
    expect(isHiddenType(['json'], 'data.xml')).toBe(false)
    expect(isHiddenType(['json'], 'json')).toBe(false)
  })
})
