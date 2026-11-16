import { jsonLanguage } from '@codemirror/lang-json'
import { autoCloseTags, xmlLanguage } from '@codemirror/lang-xml'
import { Language, LanguageSupport, foldGutter } from '@codemirror/language'
import { lintGutter } from '@codemirror/lint'
import { Compartment, Facet } from '@codemirror/state'
import { ViewPlugin } from '@codemirror/view'
import { Parser } from '@lezer/common'

import { zplHelpCompartment } from '#/components/zpl/editor-support'
import { zpl, zplHelp } from '#/components/zpl/zpl-language'
import { once, preloadWhenIdle } from '#/lib/lazy'
import { VAR_MAX_LENGTH, maskVars, maskVarsAsNumbers } from '#/lib/xml/vars'
import type { Extension } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import type { Input, PartialParse, TreeFragment } from '@lezer/common'
import type { DocLanguage } from '#/lib/document'

// The stock grammars read `<<name>>` as broken input, which throws off
// highlighting for the rest of the line. These languages feed the parser a
// masked view of the document instead (same length, so positions match).

/** How much masked text is read at once. */
const BLOCK = 16_384

/** A stretch of masked text, starting at `from`. */
interface Block {
  from: number
  text: string
}

class MaskedInput implements Input {
  readonly lineChunks = false
  // The parser asks for text at almost every token, and goes back and forth
  // between where it reads and a place it read earlier. Two blocks serve both
  // as cheap slices, instead of reading and masking text on each request.
  private blocks: Array<Block> = []

  constructor(
    private inner: Input,
    private mask: (text: string) => string,
  ) {}

  get length() {
    return this.inner.length
  }

  chunk(from: number) {
    if (from >= this.length) return ''
    const block = this.blockAt(from, from + 1) ?? this.load(from)
    return block.text.slice(from - block.from)
  }

  read(from: number, to: number) {
    const block = this.blockAt(from, to)
    return block
      ? block.text.slice(from - block.from, to - block.from)
      : this.masked(from, to)
  }

  /** The block holding all of `from`–`to`, marked as the latest used. */
  private blockAt(from: number, to: number) {
    const [latest, other] = this.blocks
    const holds = (block: Block | undefined) =>
      !!block && from >= block.from && to <= block.from + block.text.length
    if (holds(latest)) return latest
    if (!holds(other)) return undefined
    this.blocks = [other, latest]
    return other
  }

  private load(from: number) {
    const block = {
      from,
      text: this.masked(from, Math.min(this.length, from + BLOCK)),
    }
    this.blocks.unshift(block)
    this.blocks.length = Math.min(this.blocks.length, 2)
    return block
  }

  private masked(from: number, to: number) {
    // Read a little extra on both sides so a variable cut by the window edge
    // is still recognised, then trim back.
    const start = Math.max(0, from - VAR_MAX_LENGTH)
    const end = Math.min(this.length, to + VAR_MAX_LENGTH)
    const text = this.mask(this.inner.read(start, end))
    return text.slice(from - start, from - start + (to - from))
  }
}

class MaskedParser extends Parser {
  constructor(
    private inner: Parser,
    private mask: (text: string) => string,
  ) {
    super()
  }

  createParse(
    input: Input,
    fragments: ReadonlyArray<TreeFragment>,
    ranges: ReadonlyArray<{ from: number; to: number }>,
  ): PartialParse {
    return this.inner.startParse(
      new MaskedInput(input, this.mask),
      fragments,
      ranges,
    )
  }
}

const xmlSupport = new LanguageSupport(
  new Language(
    xmlLanguage.data,
    new MaskedParser(xmlLanguage.parser, maskVars),
    [],
    'xml',
  ),
  [autoCloseTags],
)

const jsonSupport = new LanguageSupport(
  new Language(
    jsonLanguage.data,
    new MaskedParser(jsonLanguage.parser, maskVarsAsNumbers),
    [],
    'json',
  ),
)

/**
 * Support for a file type that is left out of the editor's first load, since
 * most workspaces never open one. It is fetched before the editor first
 * shows a file of the type (`loadLanguages`), and for the rest once the
 * editor is idle. A file that shows sooner than that reads as plain text
 * until its support arrives.
 */
function lazySupport(fetch: () => Promise<Extension>) {
  let support: Extension | undefined
  const load = once(() => fetch().then((loaded) => (support = loaded)))
  preloadWhenIdle(load)
  const slot = new Compartment()
  /** Puts the support in an editor that started without it. */
  const loader = ViewPlugin.fromClass(
    class {
      destroyed = false

      constructor(view: EditorView) {
        void load().then(
          (loaded) => {
            // Gone with a file switch, or already in a state made since.
            if (this.destroyed || slot.get(view.state) === loaded) return
            view.dispatch({ effects: slot.reconfigure(loaded) })
          },
          // The file still edits, as plain text.
          () => undefined,
        )
      }

      destroy() {
        this.destroyed = true
      }
    },
  )
  return { load, extension: (): Extension => [slot.of(support ?? []), loader] }
}

const LAZY: Partial<Record<DocLanguage, ReturnType<typeof lazySupport>>> = {
  // SQL is only formatted, so it keeps the stock grammar and no variables,
  // with colours for tables, aliases and columns on top.
  sql: lazySupport(() =>
    import('./sql-highlight').then((mod) => mod.sqlSupport),
  ),
  md: lazySupport(() =>
    import('#/components/markdown/editor-support').then((mod) =>
      mod.markdownEditor(),
    ),
  ),
}

const SUPPORT: Partial<Record<DocLanguage, Extension>> = {
  xml: xmlSupport,
  json: jsonSupport,
  zpl: [zpl(), zplHelpCompartment.of(zplHelp({ dpi: 203, explain: true }))],
}

/**
 * Resolves once the support of each of `languages` is there, so an editor
 * made after it shows them as they read from its first frame.
 */
export async function loadLanguages(languages: Iterable<DocLanguage>) {
  await Promise.all(
    [...new Set(languages)].map((language) => LAZY[language]?.load()),
  )
}

/** The language of the file in this editor state. */
export const docLanguage = Facet.define<DocLanguage, DocLanguage>({
  combine: (values) => values.at(-1) ?? 'xml',
})

export const languageCompartment = new Compartment()

/**
 * Fold markers and lint marks. Only XML and JSON have elements to fold or
 * parse errors to mark; everywhere else the columns would sit empty.
 */
export function structureGutters(language: DocLanguage | null): Extension {
  if (language !== 'xml' && language !== 'json') return []
  return [
    foldGutter({
      markerDOM: (open) => {
        const el = document.createElement('span')
        el.textContent = open ? '▾' : '▸'
        return el
      },
    }),
    lintGutter(),
  ]
}

export function languageExtension(language: DocLanguage): Extension {
  return [
    docLanguage.of(language),
    LAZY[language]?.extension() ?? SUPPORT[language] ?? [],
  ]
}
