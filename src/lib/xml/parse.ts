import { parser } from '@lezer/xml'

import { decodeEntities } from './entities'
import { findVarProblems, maskVars } from './vars'
import { m } from '#/paraglide/messages'
import type { Tree, TreeCursor } from '@lezer/common'
import type {
  XmlAttr,
  XmlDocument,
  XmlElement,
  XmlError,
  XmlNode,
  XmlText,
} from './model'

const PREDEFINED = new Set(['lt', 'gt', 'amp', 'quot', 'apos'])

/**
 * Parses XML into a position-annotated model. Error tolerant: it always returns
 * a tree, plus the problems found. `<<var>>` placeholders are allowed anywhere
 * text or attribute values are.
 *
 * `tree` is the syntax tree of `text` read with its variables masked, when
 * one is at hand: the editor keeps one up to date as it is typed in, which
 * saves parsing the whole text again.
 */
export function parseXml(
  text: string,
  tree: Tree = parser.parse(maskVars(text)),
): XmlDocument {
  if (text.trim() === '') {
    return { language: 'xml', nodes: [], root: null, errors: [] }
  }

  const errors: Array<XmlError> = []
  // Masking leaves `<!DOCTYPE` alone, so the text says the same.
  const hasDoctype = /<!DOCTYPE/i.test(text)

  // One walk over the tree for every check, on what can be a large file.
  tree.iterate({
    enter(ref) {
      if (ref.type.isError) {
        errors.push({
          from: ref.from,
          to: Math.max(ref.to, ref.from + 1),
          message: m.parse_unexpected_input(),
        })
      } else if (ref.name === 'MismatchedCloseTag') {
        const name = ref.node.getChild('TagName')
        const label = name ? text.slice(name.from, name.to) : ''
        errors.push({
          from: ref.from,
          to: ref.to,
          message: m.parse_xml_close_mismatch({ name: label }),
        })
      } else if (ref.name === 'EntityReference' && !hasDoctype) {
        const entity = text.slice(ref.from + 1, ref.to - 1)
        if (!PREDEFINED.has(entity)) {
          errors.push({
            from: ref.from,
            to: ref.to,
            message: m.parse_xml_unknown_entity({ entity }),
          })
        }
      } else if (ref.name === 'Text' || ref.name === 'AttributeValue') {
        // `{{{var}}}` or `<tag>><<var>>` parse as text, but only
        // well-formed variables are accepted.
        errors.push(...findVarProblems(text.slice(ref.from, ref.to), ref.from))
      }
    },
  })

  const nodes = new Builder(text, errors).document(tree)

  let root: XmlElement | null = null
  for (const node of nodes) {
    if (node.kind === 'element') {
      if (root) {
        errors.push({
          from: node.nameFrom,
          to: node.nameTo,
          message: m.parse_xml_one_root(),
        })
      } else {
        root = node
      }
    } else if (node.kind === 'text' && node.raw.trim() !== '') {
      errors.push({
        from: node.from,
        to: node.to,
        message: m.parse_xml_text_outside_root(),
      })
    }
  }

  errors.sort((a, b) => a.from - b.from)
  return { language: 'xml', nodes, root, errors: dedupe(errors) }
}

export function dedupe(errors: Array<XmlError>) {
  return errors.filter(
    (error, i) =>
      i === 0 ||
      error.from !== errors[i - 1].from ||
      error.message !== errors[i - 1].message,
  )
}

/** Where an attribute's parts are, read off the tree before it is built. */
interface AttrRange {
  from: number
  to: number
  /** -1 when missing. */
  nameFrom: number
  nameTo: number
  valueFrom: number
  valueTo: number
}

/**
 * Builds the model with one cursor moving over the tree: looking children up
 * by name would make an object for every node it passes, many times over on
 * a large file.
 */
class Builder {
  constructor(
    private text: string,
    private errors: Array<XmlError>,
  ) {}

  /** The top-level nodes of `tree`. */
  document(tree: Tree): Array<XmlNode> {
    const cursor = tree.cursor()
    return cursor.firstChild() ? this.content(cursor, '', 0) : []
  }

  /**
   * Builds the node the cursor is on and every sibling after it, leaving the
   * cursor on the last of them.
   */
  private content(
    cursor: TreeCursor,
    parentPath: string,
    depth: number,
  ): Array<XmlNode> {
    const out: Array<XmlNode> = []
    const counts = new Map<string, number>()
    let textFrom = -1
    let textTo = -1

    const flushText = () => {
      if (textFrom < 0) return
      const raw = this.text.slice(textFrom, textTo)
      const node: XmlText = {
        kind: 'text',
        from: textFrom,
        to: textTo,
        raw,
        value: decodeEntities(raw),
      }
      out.push(node)
      textFrom = -1
    }

    do {
      const name = cursor.name
      if (
        name === 'Text' ||
        name === 'EntityReference' ||
        name === 'CharacterReference'
      ) {
        if (textFrom >= 0 && textTo === cursor.from) textTo = cursor.to
        else {
          flushText()
          textFrom = cursor.from
          textTo = cursor.to
        }
        continue
      }
      flushText()
      switch (name) {
        case 'Element':
          out.push(this.element(cursor, parentPath, counts, depth))
          break
        case 'Comment':
          out.push(this.other('comment', cursor))
          break
        case 'Cdata':
          out.push(this.other('cdata', cursor))
          break
        case 'ProcessingInst':
          out.push(this.other('pi', cursor))
          break
        case 'DoctypeDecl':
          out.push(this.other('doctype', cursor))
          break
      }
    } while (cursor.nextSibling())
    flushText()
    return out
  }

  private other(
    kind: 'comment' | 'cdata' | 'pi' | 'doctype',
    cursor: TreeCursor,
  ) {
    const { from, to } = cursor
    return { kind, from, to, raw: this.text.slice(from, to) }
  }

  /** The element the cursor is on, leaving the cursor there. */
  private element(
    cursor: TreeCursor,
    parentPath: string,
    counts: Map<string, number>,
    depth: number,
  ): XmlElement {
    const { from, to } = cursor
    // Its open tag comes first, then its content, then its close tag.
    let openFrom = from
    let openTo = from
    let selfClosing = false
    let nameFrom = -1
    let nameTo = -1
    let endFrom = -1
    let selfEndFrom = -1
    let closeFrom: number | null = null
    let closeNameFrom: number | null = null
    let closeNameTo: number | null = null
    let missing = false
    const attrRanges: Array<AttrRange> = []

    const hasParts = cursor.firstChild()
    if (hasParts) {
      selfClosing = cursor.name === 'SelfClosingTag'
      openFrom = cursor.from
      openTo = cursor.to
      if (cursor.firstChild()) {
        do {
          const part = cursor.name
          if (part === 'TagName' && nameFrom < 0) {
            nameFrom = cursor.from
            nameTo = cursor.to
          } else if (part === 'Attribute') attrRanges.push(attrRange(cursor))
          else if (part === 'EndTag' && endFrom < 0) endFrom = cursor.from
          else if (part === 'SelfCloseEndTag' && selfEndFrom < 0)
            selfEndFrom = cursor.from
        } while (cursor.nextSibling())
        cursor.parent()
      }
      while (cursor.nextSibling()) {
        if (cursor.name === 'MissingCloseTag') missing = true
        else if (cursor.name === 'CloseTag' && closeFrom === null) {
          closeFrom = cursor.from
          const tag = childRange(cursor, 'TagName')
          closeNameFrom = tag?.from ?? null
          closeNameTo = tag?.to ?? null
        }
      }
      cursor.parent()
    }
    if (nameFrom < 0) nameFrom = nameTo = openFrom

    const name = this.text.slice(nameFrom, nameTo)
    const index = (counts.get(name) ?? 0) + 1
    counts.set(name, index)
    const path = `${parentPath}/${name}[${index}]`

    if (missing) {
      this.errors.push({
        from: nameFrom,
        to: nameTo,
        message: m.parse_xml_not_closed({ name }),
      })
    }
    const attrs = this.attrs(attrRanges)

    let children: Array<XmlNode> = []
    if (hasParts && !selfClosing) {
      cursor.firstChild()
      if (cursor.nextSibling()) children = this.content(cursor, path, depth + 1)
      cursor.parent()
    }

    return {
      kind: 'element',
      path,
      name,
      depth,
      from,
      to,
      nameFrom,
      nameTo,
      openEndFrom:
        endFrom >= 0 ? endFrom : selfEndFrom >= 0 ? selfEndFrom : openTo,
      openTo,
      closeFrom,
      closeNameFrom,
      closeNameTo,
      selfClosing,
      attrs,
      children,
    }
  }

  private attrs(ranges: Array<AttrRange>): Array<XmlAttr> {
    const attrs: Array<XmlAttr> = []
    const seen = new Set<string>()
    for (const attr of ranges) {
      if (attr.nameFrom < 0) continue
      const name = this.text.slice(attr.nameFrom, attr.nameTo)
      if (seen.has(name)) {
        this.errors.push({
          from: attr.nameFrom,
          to: attr.nameTo,
          message: m.parse_xml_duplicate_attribute({ name }),
        })
      }
      seen.add(name)

      let valueFrom = attr.to
      let valueTo = attr.to
      let quote: '"' | "'" = '"'
      if (attr.valueFrom >= 0) {
        const first = this.text[attr.valueFrom]
        quote = first === "'" ? "'" : '"'
        valueFrom = attr.valueFrom + 1
        const last = this.text[attr.valueTo - 1]
        valueTo =
          attr.valueTo - attr.valueFrom >= 2 && last === quote
            ? attr.valueTo - 1
            : attr.valueTo
      }
      const raw = this.text.slice(valueFrom, valueTo)
      attrs.push({
        name,
        raw,
        value: decodeEntities(raw),
        from: attr.from,
        to: attr.to,
        nameFrom: attr.nameFrom,
        nameTo: attr.nameTo,
        valueFrom,
        valueTo,
        quote,
      })
    }
    return attrs
  }
}

/** The range of the first child named `name`, leaving the cursor where it is. */
function childRange(cursor: TreeCursor, name: string) {
  if (!cursor.firstChild()) return undefined
  let range: { from: number; to: number } | undefined
  do {
    if (cursor.name === name) range = { from: cursor.from, to: cursor.to }
  } while (!range && cursor.nextSibling())
  cursor.parent()
  return range
}

/** The parts of the attribute the cursor is on, leaving the cursor there. */
function attrRange(cursor: TreeCursor): AttrRange {
  const range: AttrRange = {
    from: cursor.from,
    to: cursor.to,
    nameFrom: -1,
    nameTo: -1,
    valueFrom: -1,
    valueTo: -1,
  }
  if (!cursor.firstChild()) return range
  do {
    if (cursor.name === 'AttributeName' && range.nameFrom < 0) {
      range.nameFrom = cursor.from
      range.nameTo = cursor.to
    } else if (cursor.name === 'AttributeValue' && range.valueFrom < 0) {
      range.valueFrom = cursor.from
      range.valueTo = cursor.to
    }
  } while (cursor.nextSibling())
  cursor.parent()
  return range
}
