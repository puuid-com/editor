// Structured edits from the tree for JSON documents, as minimal text changes
// (see `#/lib/xml/edit`).

import { VAR_PATTERN } from '#/lib/xml/vars'
import type { TextChange } from '#/lib/xml/edit'
import type { JsonType, XmlElement } from '#/lib/xml/model'

const LITERAL_RE = new RegExp(
  `^(?:-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:[eE][+-]?\\d+)?|true|false|null|${VAR_PATTERN})$`,
)

/**
 * The JSON for a value typed in the tree. Strings stay strings; other values
 * keep their type when the text is still a number, `true`, `false`, `null`
 * or a `<<var>>`, and become strings otherwise.
 */
export function jsonLiteral(value: string, type: JsonType) {
  const trimmed = value.trim()
  if (type !== 'string' && LITERAL_RE.test(trimmed)) return trimmed
  return JSON.stringify(value)
}

export function setJsonValue(el: XmlElement, value: string): Array<TextChange> {
  const info = el.json
  if (!info || info.type === 'object' || info.type === 'array') return []
  return [
    {
      from: info.valueFrom,
      to: info.valueTo,
      insert: jsonLiteral(value, info.type),
    },
  ]
}
