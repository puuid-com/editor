import { syntaxTree } from '@codemirror/language'
import { Compartment, Facet, StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'

import { m } from '#/paraglide/messages'
import type { EditorState, Extension, Range } from '@codemirror/state'
import type { DecorationSet } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'

// In a SOAP message, the envelope's own tags (Envelope, Header, Body, Fault)
// can hide their `xmlns` declarations and show the URLs in their attributes
// as a `…` chip that expands them. Display only: the document, search and
// save still see the full text.

export interface SoapDisplay {
  /** Hide `xmlns` and `xmlns:prefix` attributes on SOAP tags. */
  hideNamespaces: boolean
  /** Show URL attribute values on SOAP tags as `…` until expanded. */
  shortenUrls: boolean
}

const OFF: SoapDisplay = { hideNamespaces: false, shortenUrls: false }

const displayFacet = Facet.define<SoapDisplay, SoapDisplay>({
  combine: (values) => values.at(-1) ?? OFF,
})

const displayCompartment = new Compartment()

/** Effect that changes what SOAP tags hide. */
export function setSoapDisplay(display: SoapDisplay) {
  return displayCompartment.reconfigure(displayFacet.of(display))
}

/** Expands (true) or shortens again (false) the URL starting at `from`. */
const toggleUrl = StateEffect.define<{ from: number; open: boolean }>({
  map: (value, changes) => ({ ...value, from: changes.mapPos(value.from) }),
})

const SOAP_TAGS = new Set(['Envelope', 'Header', 'Body', 'Fault'])
const URL_VALUE = /^(?:[a-z][a-z0-9+.-]*:\/\/|urn:)\S+$/i

function splitName(name: string) {
  const colon = name.indexOf(':')
  return colon < 0
    ? { prefix: '', local: name }
    : { prefix: name.slice(0, colon), local: name.slice(colon + 1) }
}

function tagOf(element: SyntaxNode) {
  return element.getChild('OpenTag') ?? element.getChild('SelfClosingTag')
}

interface Span {
  from: number
  to: number
}

/** What the settings hide on SOAP tags: whole attributes, and URLs. */
export function soapRanges(state: EditorState, display: SoapDisplay) {
  const hidden: Array<Span> = []
  const urls: Array<Span> = []
  if (!display.hideNamespaces && !display.shortenUrls) return { hidden, urls }
  const root = syntaxTree(state).topNode.getChild('Element')
  const rootName = root && tagOf(root)?.getChild('TagName')
  if (!rootName) return { hidden, urls }
  const envelope = splitName(state.sliceDoc(rootName.from, rootName.to))
  if (envelope.local !== 'Envelope') return { hidden, urls }

  const visit = (element: SyntaxNode) => {
    const tag = tagOf(element)
    const name = tag?.getChild('TagName')
    if (!tag || !name) return
    const { prefix, local } = splitName(state.sliceDoc(name.from, name.to))
    if (prefix !== envelope.prefix || !SOAP_TAGS.has(local)) return
    for (const attr of tag.getChildren('Attribute')) {
      const attrName = attr.getChild('AttributeName')
      const value = attr.getChild('AttributeValue')
      if (!attrName) continue
      const text = state.sliceDoc(attrName.from, attrName.to)
      if (
        display.hideNamespaces &&
        (text === 'xmlns' || text.startsWith('xmlns:'))
      ) {
        // Take the space before it too, so no gap is left behind.
        const before = state.sliceDoc(name.to, attr.from)
        const space = before.length - before.trimEnd().length
        hidden.push({ from: attr.from - space, to: attr.to })
        continue
      }
      if (!display.shortenUrls || !value || value.to - value.from < 3) continue
      const inner = { from: value.from + 1, to: value.to - 1 }
      if (URL_VALUE.test(state.sliceDoc(inner.from, inner.to))) urls.push(inner)
    }
    // Header, Body and Fault sit inside the envelope, and Fault in Body.
    for (const child of element.getChildren('Element')) visit(child)
  }
  visit(root)
  return { hidden, urls }
}

const EXPAND_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6"/></svg>'

const COLLAPSE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6"/></svg>'

/** The `… ⌄` chip in place of a URL, or the `⌃` one after an expanded URL. */
class UrlWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly open: boolean,
  ) {
    super()
  }

  eq(other: UrlWidget) {
    return other.from === this.from && other.open === this.open
  }

  toDOM(view: EditorView) {
    const chip = document.createElement('span')
    chip.className = 'cm-long-value'
    const title = this.open ? m.soap_url_collapse() : m.soap_url_expand()
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'cm-long-value-size'
    el.title = title
    el.setAttribute('aria-label', title)
    el.innerHTML = this.open ? COLLAPSE_ICON : `…${EXPAND_ICON}`
    // Keep the editor from moving the cursor under the chip.
    el.addEventListener('mousedown', (event) => event.preventDefault())
    el.addEventListener('click', (event) => {
      event.preventDefault()
      view.dispatch({
        effects: toggleUrl.of({ from: this.from, open: !this.open }),
      })
    })
    chip.appendChild(el)
    return chip
  }

  ignoreEvent() {
    return true
  }
}

interface SoapState {
  /** Start of each URL the user expanded, mapped through edits. */
  open: ReadonlySet<number>
  urls: Array<Span>
  decorations: DecorationSet
}

const hide = Decoration.replace({})

function build(
  state: EditorState,
  open: ReadonlySet<number>,
): Omit<SoapState, 'open'> {
  const { hidden, urls } = soapRanges(state, state.facet(displayFacet))
  const ranges: Array<Range<Decoration>> = hidden.map((span) =>
    hide.range(span.from, span.to),
  )
  for (const url of urls) {
    ranges.push(
      open.has(url.from)
        ? Decoration.widget({
            widget: new UrlWidget(url.from, true),
            side: 1,
          }).range(url.to)
        : Decoration.replace({
            widget: new UrlWidget(url.from, false),
          }).range(url.from, url.to),
    )
  }
  return { urls, decorations: Decoration.set(ranges, true) }
}

/** A URL the selection lands inside, e.g. after a search jump, opens up. */
function openAtSelection(
  state: EditorState,
  urls: ReadonlyArray<Span>,
  open: Set<number>,
) {
  let changed = false
  for (const range of state.selection.ranges) {
    for (const url of urls) {
      if (open.has(url.from)) continue
      if (range.from > url.from && range.to < url.to) {
        open.add(url.from)
        changed = true
      }
    }
  }
  return changed
}

const soapField = StateField.define<SoapState>({
  create(state) {
    const open = new Set<number>()
    return { open, ...build(state, open) }
  },
  update(value, tr) {
    let open = value.open
    if (tr.docChanged && open.size > 0) {
      open = new Set([...open].map((pos) => tr.changes.mapPos(pos)))
    }
    for (const effect of tr.effects) {
      if (!effect.is(toggleUrl)) continue
      const next = new Set(open)
      if (effect.value.open) next.add(effect.value.from)
      else next.delete(effect.value.from)
      open = next
    }
    const stale =
      open !== value.open ||
      tr.docChanged ||
      syntaxTree(tr.startState) !== syntaxTree(tr.state) ||
      tr.startState.facet(displayFacet) !== tr.state.facet(displayFacet)
    let built = stale ? build(tr.state, open) : value
    if (tr.selection) {
      const next = new Set(open)
      if (openAtSelection(tr.state, built.urls, next)) {
        open = next
        built = build(tr.state, open)
      }
    }
    if (built === value) return value
    return { open, urls: built.urls, decorations: built.decorations }
  },
  provide: (field) => [
    EditorView.decorations.from(field, (value) => value.decorations),
    EditorView.atomicRanges.of((view) => view.state.field(field).decorations),
  ],
})

/** Hides namespace declarations and shortens URLs on SOAP envelope tags. */
export function soapDisplay(display: SoapDisplay = OFF): Extension {
  return [displayCompartment.of(displayFacet.of(display)), soapField]
}
