import { formatDocument, languageOf } from './document'
import type { FormatOptions } from './xml/format'

export interface CompareSide {
  name: string
  content: string
}

export interface CompareTexts {
  a: string
  b: string
  /** Whether both sides were formatted before diffing. */
  formatted: boolean
  /** Name of the first file that doesn't parse, when formatting was asked for. */
  unparsed: string | null
}

/**
 * The two texts to diff. With `ignoreFormatting`, both sides are formatted
 * with the same options first, so only differences in the data remain; when
 * either side doesn't parse, both stay as written.
 */
export function compareTexts(
  a: CompareSide,
  b: CompareSide,
  ignoreFormatting: boolean,
  options: FormatOptions,
): CompareTexts {
  const raw = { a: a.content, b: b.content, formatted: false, unparsed: null }
  if (!ignoreFormatting) return raw
  const left = formatDocument(a.content, languageOf(a.name, a.content), options)
  if (!left.ok) return { ...raw, unparsed: a.name }
  const right = formatDocument(
    b.content,
    languageOf(b.name, b.content),
    options,
  )
  if (!right.ok) return { ...raw, unparsed: b.name }
  return { a: left.text, b: right.text, formatted: true, unparsed: null }
}
