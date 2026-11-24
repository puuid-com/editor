import { describe, expect, it } from 'vitest'

import {
  canFormat,
  detectLanguage,
  downloadName,
  formatDocument,
  hasVariables,
  isPlain,
  languageOf,
  typedName,
  untypedName,
} from './document'

describe('detectLanguage', () => {
  it('reads XML, JSON and flat files from their content', () => {
    expect(detectLanguage('\n  <invoice/>')).toBe('xml')
    expect(detectLanguage(' {"a": 1}')).toBe('json')
    expect(detectLanguage('[1, 2]')).toBe('json')
  })

  it('reads SQL from a leading statement keyword', () => {
    expect(detectLanguage('select 1')).toBe('sql')
    expect(detectLanguage('-- report\nWITH a AS (SELECT 1) SELECT *')).toBe(
      'sql',
    )
    expect(detectLanguage('selection')).toBeNull()
  })

  it('reads Markdown from a leading heading', () => {
    expect(detectLanguage('# Notes\n\nSome text')).toBe('md')
    expect(detectLanguage('\n### Setup')).toBe('md')
    expect(detectLanguage('#hashtag')).toBeNull()
  })

  it('gives up on content with nothing to go by', () => {
    expect(detectLanguage('hello')).toBeNull()
    expect(detectLanguage('')).toBeNull()
  })
})

describe('untypedName', () => {
  it('drops the extension that gives the type', () => {
    expect(untypedName('invoice.xml')).toBe('invoice')
    expect(untypedName('data.JSON')).toBe('data')
    expect(untypedName('records.txt')).toBe('records')
    expect(untypedName('notes.md')).toBe('notes')
  })

  it('keeps names without a type extension', () => {
    expect(untypedName('untitled')).toBe('untitled')
    expect(untypedName('notes.txt.bak')).toBe('notes.txt.bak')
    expect(untypedName('.xml')).toBe('.xml')
  })
})

describe('typedName', () => {
  it('adds or swaps the extension for the type', () => {
    expect(typedName('untitled', 'xml')).toBe('untitled.xml')
    expect(typedName('invoice.xml', 'json')).toBe('invoice.json')
    expect(typedName('data.json', 'flat')).toBe('data.txt')
    expect(typedName('untitled', 'md')).toBe('untitled.md')
    expect(typedName('invoice.xml', 'txt')).toBe('invoice.txt')
  })

  it('keeps an extension that already reads as the type', () => {
    expect(typedName('icon.svg', 'xml')).toBe('icon.svg')
    expect(typedName('site.webmanifest', 'json')).toBe('site.webmanifest')
    expect(typedName('batch.dat', 'flat')).toBe('batch.dat')
  })
})

describe('languageOf', () => {
  it('reads Markdown by extension, whatever the content', () => {
    expect(languageOf('README.md', '<div>hi</div>')).toBe('md')
    expect(languageOf('guide.markdown', '')).toBe('md')
  })

  it('reads a .txt file as plain text unless it holds flat records', () => {
    expect(languageOf('notes.txt', 'hello <world>')).toBe('txt')
    expect(languageOf('server.log', '{"level":"info"}')).toBe('txt')
    expect(languageOf('records.txt', 'SH|001\nPC|002')).toBe('flat')
  })

  it('reads an untitled file that starts with a heading as Markdown', () => {
    expect(languageOf('untitled', '# Title')).toBe('md')
  })

  it('reads an untitled file of plain text as Markdown', () => {
    expect(languageOf('untitled', 'hello there')).toBe('md')
    expect(languageOf('untitled', '<order/>')).toBe('xml')
    expect(languageOf('untitled', '{"a": 1}')).toBe('json')
    expect(languageOf('untitled', '')).toBe('xml')
  })
})

describe('isPlain', () => {
  it('marks the types with no elements to act on', () => {
    expect(isPlain('md')).toBe(true)
    expect(isPlain('txt')).toBe(true)
    expect(isPlain('sql')).toBe(true)
    expect(isPlain('zpl')).toBe(true)
    expect(isPlain('xml')).toBe(false)
    expect(isPlain('json')).toBe(false)
    expect(isPlain('flat')).toBe(false)
  })
})

describe('hasVariables', () => {
  it('gives every text file variables, and images none', () => {
    for (const language of [
      'xml',
      'json',
      'flat',
      'sql',
      'zpl',
      'md',
      'txt',
    ] as const)
      expect(hasVariables(language)).toBe(true)
    expect(hasVariables('image')).toBe(false)
  })
})

describe('canFormat', () => {
  it('offers Format only where it rewrites the text', () => {
    expect(canFormat('xml')).toBe(true)
    expect(canFormat('json')).toBe(true)
    expect(canFormat('sql')).toBe(true)
    expect(canFormat('md')).toBe(true)
    expect(canFormat('flat')).toBe(false)
    expect(canFormat('zpl')).toBe(false)
    expect(canFormat('txt')).toBe(false)
  })
})

describe('formatDocument', () => {
  it('keeps the variables of a SQL file whole', () => {
    expect(formatDocument('select {{col}} from t', 'sql', {})).toEqual({
      ok: true,
      text: 'SELECT {{col}}\nFROM t',
    })
  })
})

describe('downloadName', () => {
  it('keeps a name with an extension and gives one to a name without', () => {
    expect(downloadName('label.zpl', 'zpl')).toBe('label.zpl')
    expect(downloadName('notes.txt', 'md')).toBe('notes.txt')
    expect(downloadName('order', 'json')).toBe('order.json')
  })
})
