import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setCodeFont } from './code-font'
import { editorPrefs } from './word-wrap'
import {
  CODE_FONT_PROPERTY,
  TEXT_FONT_PROPERTY,
  codeFontScript,
} from '#/lib/code-font'

const applied = () =>
  document.documentElement.style.getPropertyValue(CODE_FONT_PROPERTY)
const text = () =>
  document.documentElement.style.getPropertyValue(TEXT_FONT_PROPERTY)
const runScript = () => new Function(codeFontScript)()
const stubFonts = (load: () => Promise<unknown>) =>
  vi.stubGlobal('document', Object.assign(document, { fonts: { load } }))

beforeEach(() => {
  document.documentElement.style.removeProperty(CODE_FONT_PROPERTY)
  document.documentElement.style.removeProperty(TEXT_FONT_PROPERTY)
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('setCodeFont', () => {
  it('applies the font and stores what the first-paint script reads', async () => {
    stubFonts(() => Promise.resolve([]))
    await setCodeFont('ioskeley-mono')
    expect(applied()).toContain('Ioskeley Mono')

    document.documentElement.style.removeProperty(CODE_FONT_PROPERTY)
    runScript()
    expect(applied()).toContain('Ioskeley Mono')
  })

  it('sets text in Times New Roman and keeps code monospace', async () => {
    stubFonts(() => Promise.resolve([]))
    await setCodeFont('times-new-roman')
    expect(text()).toContain('Times New Roman')
    expect(applied()).toContain('Geist Mono')

    document.documentElement.style.removeProperty(TEXT_FONT_PROPERTY)
    runScript()
    expect(text()).toContain('Times New Roman')

    await setCodeFont('ioskeley-mono')
    expect(text()).toBe('')
    expect(applied()).toContain('Ioskeley Mono')
  })

  it('still applies the font when it fails to load', async () => {
    stubFonts(() => Promise.reject(new Error('offline')))
    await setCodeFont('ioskeley-mono')
    expect(applied()).toContain('Ioskeley Mono')
  })

  it('keeps the latest pick when an earlier one loads last', async () => {
    let finishFirst = () => {}
    stubFonts(
      vi
        .fn<() => Promise<unknown>>()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finishFirst = () => resolve([])
            }),
        )
        .mockResolvedValue([]),
    )
    const first = setCodeFont('ioskeley-mono')
    await setCodeFont('geist-mono')
    finishFirst()
    await first
    expect(editorPrefs.state.codeFont).toBe('geist-mono')
    expect(applied()).toContain('Geist Mono')
  })
})

describe('codeFontScript', () => {
  it.each(['{"codeFont":"comic-sans"}', 'not json', '{}'])(
    'leaves the default font for %s',
    (stored) => {
      localStorage.setItem('xml-editor:editor-preferences', stored)
      runScript()
      expect(applied()).toBe('')
    },
  )
})
