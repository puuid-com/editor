import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'

import { languageExtension } from './language'
import { soapRanges } from './soap-namespaces'

function stateOf(doc: string) {
  return EditorState.create({ doc, extensions: languageExtension('xml') })
}

const ENVELOPE = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns="urn:x" soap:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <soap:Body xmlns:m="http://example.com/m">
    <m:Get xmlns:m="http://example.com/m" href="http://example.com"/>
  </soap:Body>
</soap:Envelope>`

const ALL = { hideNamespaces: true, shortenUrls: true }

describe('soapRanges', () => {
  it('hides xmlns attributes on SOAP tags only, with their leading space', () => {
    const state = stateOf(ENVELOPE)
    const { hidden } = soapRanges(state, ALL)
    expect(hidden.map((s) => ENVELOPE.slice(s.from, s.to))).toEqual([
      ' xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"',
      ' xmlns="urn:x"',
      ' xmlns:m="http://example.com/m"',
    ])
  })

  it('shortens URL values left on SOAP tags', () => {
    const { urls } = soapRanges(stateOf(ENVELOPE), ALL)
    expect(urls.map((s) => ENVELOPE.slice(s.from, s.to))).toEqual([
      'http://schemas.xmlsoap.org/soap/encoding/',
    ])
  })

  it('shortens namespace URLs when they are not hidden', () => {
    const { hidden, urls } = soapRanges(stateOf(ENVELOPE), {
      hideNamespaces: false,
      shortenUrls: true,
    })
    expect(hidden).toEqual([])
    expect(urls).toHaveLength(4)
  })

  it('leaves documents without a SOAP envelope alone', () => {
    const doc = '<Body xmlns:a="http://a.example"/>'
    expect(soapRanges(stateOf(doc), ALL)).toEqual({ hidden: [], urls: [] })
  })
})
