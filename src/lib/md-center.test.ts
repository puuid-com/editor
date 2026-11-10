import { beforeEach, describe, expect, it } from 'vitest'

import { PREFERENCES_KEY } from './code-font'
import { CENTER_ATTRIBUTE, applyCentered, centerScript } from './md-center'

const attribute = () => document.documentElement.getAttribute(CENTER_ATTRIBUTE)
const runScript = () => new Function(centerScript)()

beforeEach(() => {
  document.documentElement.removeAttribute(CENTER_ATTRIBUTE)
  localStorage.clear()
})

describe('centerScript', () => {
  it('centers diagrams until a choice is stored', () => {
    runScript()
    expect(attribute()).toBe('mermaid')
  })

  it('applies the stored choice before first paint', () => {
    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ centered: ['table', 'code'] }),
    )
    runScript()
    expect(attribute()).toBe('table code')
  })
})

describe('applyCentered', () => {
  it('sets the centered blocks on <html>', () => {
    applyCentered(['image'])
    expect(attribute()).toBe('image')
    applyCentered([])
    expect(attribute()).toBe('')
  })
})
