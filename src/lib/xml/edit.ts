// Turns structured edits from the tree into minimal text changes, so the
// document keeps its formatting and every edit is one undoable transaction.
// Changes are compatible with CodeMirror's `ChangeSpec`.

import { escapeAttr, escapeText } from './entities'
import type { XmlAttr, XmlElement } from './model'

export interface TextChange {
  from: number
  to: number
  insert: string
}

export function setText(el: XmlElement, value: string): Array<TextChange> {
  const onlyChild = el.children.length === 1 ? el.children[0] : null
  if (onlyChild?.kind === 'cdata') {
    return [
      {
        from: onlyChild.from + 9,
        to: onlyChild.to - 3,
        insert: value.replaceAll(']]>', ']]]]><![CDATA[>'),
      },
    ]
  }
  if (el.selfClosing) {
    if (value === '') return []
    return [
      {
        from: openTagContentEnd(el),
        to: el.to,
        insert: `>${escapeText(value)}</${el.name}>`,
      },
    ]
  }
  if (el.closeFrom === null) return []
  return [{ from: el.openTo, to: el.closeFrom, insert: escapeText(value) }]
}

export function setAttr(attr: XmlAttr, value: string): Array<TextChange> {
  return [
    {
      from: attr.valueFrom,
      to: attr.valueTo,
      insert: escapeAttr(value, attr.quote),
    },
  ]
}

/** End of the last name or attribute, so `<a />` becomes `<a>` not `<a >`. */
function openTagContentEnd(el: XmlElement) {
  return el.attrs.length > 0 ? el.attrs[el.attrs.length - 1].to : el.nameTo
}

/** Smallest single change turning `before` into `after`, or `null` if equal. */
export function diffChange(before: string, after: string): TextChange | null {
  if (before === after) return null
  let start = 0
  const max = Math.min(before.length, after.length)
  while (start < max && before[start] === after[start]) start++
  let endBefore = before.length
  let endAfter = after.length
  while (
    endBefore > start &&
    endAfter > start &&
    before[endBefore - 1] === after[endAfter - 1]
  ) {
    endBefore--
    endAfter--
  }
  return {
    from: start,
    to: endBefore,
    insert: after.slice(start, endAfter),
  }
}
