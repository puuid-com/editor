import { syntaxTree } from '@codemirror/language'
import { RangeSet, StateEffect, StateField } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  GutterMarker,
  ViewPlugin,
  WidgetType,
  gutter,
} from '@codemirror/view'
import type { EditorState, Extension, Range, Text } from '@codemirror/state'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'

import { treeChanged } from '#/components/editor/syntax'
import { editorPrefs } from '#/components/editor/word-wrap'
import { isImagePath, parseWikilink } from '#/lib/obsidian'
import { m } from '#/paraglide/messages'

// Live preview, as in Obsidian: the Markdown reads as it renders, in the
// editor itself. Marks (`**`, `#`, backticks, a link's URL) are hidden and a
// bullet, checkbox or rule drawn in their place, until the selection touches
// them: inline marks come back when it touches their span, line marks
// (headings, quotes, lists, rules) when it is on their line.

/** Switches live preview on or off in an editor. */
export const setMarkdownLive = StateEffect.define<boolean>()

const markdownLive = StateField.define<boolean>({
  create: () => editorPrefs.state.markdownLive,
  update(on, tr) {
    for (const effect of tr.effects)
      if (effect.is(setMarkdownLive)) on = effect.value
    return on
  },
})

/** Whether the editor shows Markdown as live preview. */
export const isLive = (state: EditorState) =>
  state.field(markdownLive, false) ?? false

/** Whether the update switched live preview on or off. */
export const liveChanged = (update: ViewUpdate) =>
  isLive(update.startState) !== isLive(update.state)

/** Whether the selection touches `from`–`to`, its ends included. */
export function touched(state: EditorState, from: number, to: number) {
  return state.selection.ranges.some(
    (range) => range.from <= to && range.to >= from,
  )
}

/**
 * Whether the wikilink at `from`–`to` is an embed `liveEmbeds` draws: an
 * image, or a note alone on its line.
 */
export function drawnEmbed(doc: Text, from: number, to: number) {
  const text = doc.sliceString(from, to)
  if (!text.startsWith('![[')) return false
  return (
    isImagePath(parseWikilink(text.slice(3, -2)).target) ||
    doc.lineAt(from).text.trim() === text
  )
}

/** Toggles live preview in every editor, and the preview panel with it. */
export function toggleMarkdownLive() {
  editorPrefs.setState((s) => ({ ...s, markdownLive: !s.markdownLive }))
}

/* ---------------- Widgets ---------------- */

class Bullet extends WidgetType {
  eq() {
    return true
  }
  toDOM() {
    const bullet = document.createElement('span')
    bullet.className = 'cm-md-bullet'
    bullet.textContent = '•'
    return bullet
  }
  ignoreEvent() {
    return false
  }
}

class Rule extends WidgetType {
  eq() {
    return true
  }
  toDOM() {
    const rule = document.createElement('span')
    rule.className = 'cm-md-rule'
    return rule
  }
  ignoreEvent() {
    return false
  }
}

/** `[ ]` or `[x]` as a checkbox that ticks the task in the source. */
class Checkbox extends WidgetType {
  constructor(readonly checked: boolean) {
    super()
  }
  eq(other: Checkbox) {
    return other.checked === this.checked
  }
  toDOM(view: EditorView) {
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.className = 'cm-md-task'
    box.checked = this.checked
    box.setAttribute('aria-label', m.md_task_toggle())
    // The click ticks the source, not the box; the caret stays where it is.
    box.addEventListener('mousedown', (event) => event.preventDefault())
    box.addEventListener('click', (event) => {
      event.preventDefault()
      toggleTask(view, view.posAtDOM(box))
    })
    return box
  }
  ignoreEvent() {
    return true
  }
}

/** Ticks or unticks the `[ ]` task marker starting at `pos`. */
export function toggleTask(view: EditorView, pos: number) {
  const marker = view.state.sliceDoc(pos, pos + 3)
  if (!/^\[[ xX]\]$/.test(marker)) return
  view.dispatch({
    changes: {
      from: pos + 1,
      to: pos + 2,
      insert: marker[1] === ' ' ? 'x' : ' ',
    },
    userEvent: 'input',
  })
}

const hidden = Decoration.replace({})
const bullet = Decoration.replace({ widget: new Bullet() })
const rule = Decoration.replace({ widget: new Rule() })
const checked = Decoration.replace({ widget: new Checkbox(true) })
const unchecked = Decoration.replace({ widget: new Checkbox(false) })

/* ---------------- Decorations ---------------- */

/** Inline spans whose marks hide, and the marks they hold. */
const INLINE: Record<string, string> = {
  Emphasis: 'EmphasisMark',
  StrongEmphasis: 'EmphasisMark',
  Strikethrough: 'StrikethroughMark',
  Highlight: 'HighlightMark',
  InlineCode: 'CodeMark',
  Autolink: 'LinkMark',
}

/** Shown as written: code and HTML. Images are drawn by `liveEmbeds`. */
const SKIP = new Set([
  'FencedCode',
  'CodeBlock',
  'HTMLBlock',
  'CommentBlock',
  'Image',
  // Its own plugin hides its tags.
  'HTMLCode',
])

function liveDecorations(view: EditorView): DecorationSet {
  const { state } = view
  if (!isLive(state)) return Decoration.none
  const { doc } = state
  const ranges: Array<Range<Decoration>> = []
  const add = (decoration: Decoration, from: number, to: number) => {
    // A plugin can't replace across a line break.
    if (to > from && !doc.sliceString(from, to).includes('\n'))
      ranges.push(decoration.range(from, to))
  }
  const hide = (from: number, to: number) => add(hidden, from, to)
  const onLine = (pos: number) => {
    const line = doc.lineAt(pos)
    return touched(state, line.from, line.to)
  }
  const spaceAfter = (pos: number) =>
    pos + (/^[ \t]+/.exec(doc.sliceString(pos, pos + 8))?.[0].length ?? 0)

  const { from, to } = view.viewport
  syntaxTree(state).iterate({
    from,
    to,
    enter: (ref) => {
      const { name } = ref
      if (SKIP.has(name)) return false
      // A table at the top level shows as a grid instead.
      if (name === 'Table' && ref.node.parent?.name === 'Document') return false
      const node = ref.node
      const mark = INLINE[name] as string | undefined
      if (mark) {
        if (!touched(state, node.from, node.to))
          for (const child of node.getChildren(mark)) hide(child.from, child.to)
        return undefined
      }
      switch (name) {
        case 'Link': {
          if (touched(state, node.from, node.to)) return undefined
          const marks = node.getChildren('LinkMark')
          // `[text](url)` and `[text][ref]` show their text.
          if (marks.length < 2) return undefined
          hide(marks[0].from, marks[0].to)
          hide(marks[1].from, node.to)
          return undefined
        }
        case 'WikiLink': {
          if (touched(state, node.from, node.to)) return undefined
          const marks = node.getChildren('WikiLinkMark')
          if (marks.length < 2) return undefined
          if (drawnEmbed(doc, node.from, node.to)) return undefined
          const [open, close] = marks
          // `[[note|alias]]` shows its alias.
          const pipe = doc.sliceString(open.to, close.from).indexOf('|')
          hide(open.from, pipe < 0 ? open.to : open.to + pipe + 1)
          hide(close.from, close.to)
          return undefined
        }
        case 'Escape':
          if (!touched(state, node.from, node.to))
            hide(node.from, node.from + 1)
          return undefined
        case 'HeaderMark': {
          // A setext heading's underline would leave a blank line behind.
          if (!node.parent?.name.startsWith('ATXHeading') || onLine(node.from))
            return undefined
          if (node.from === doc.lineAt(node.from).from)
            hide(node.from, spaceAfter(node.to))
          else {
            // The closing `##` and the space before it.
            const before = doc.sliceString(node.from - 8, node.from)
            hide(node.from - (before.length - before.trimEnd().length), node.to)
          }
          return undefined
        }
        case 'QuoteMark':
          // The space after it stays, clear of the quote's rule.
          if (!onLine(node.from)) hide(node.from, node.to)
          return undefined
        case 'ListMark': {
          const item = node.parent
          if (!item || onLine(node.from)) return undefined
          // A task shows its checkbox and no bullet.
          if (item.getChild('Task')) hide(node.from, spaceAfter(node.to))
          else if (item.parent?.name === 'BulletList')
            add(bullet, node.from, node.to)
          return undefined
        }
        case 'TaskMarker':
          if (!onLine(node.from))
            add(
              /x/i.test(doc.sliceString(node.from, node.to))
                ? checked
                : unchecked,
              node.from,
              spaceAfter(node.to),
            )
          return undefined
        case 'HorizontalRule':
          if (!onLine(node.from)) add(rule, node.from, node.to)
          return false
        default:
          return undefined
      }
    },
  })
  return Decoration.set(ranges, true)
}

/** `H1`–`H6` beside a heading whose `#` marks are hidden. */
class HeadingLevel extends GutterMarker {
  constructor(readonly level: number) {
    super()
  }
  eq(other: HeadingLevel) {
    return other.level === this.level
  }
  toDOM() {
    const box = document.createElement('span')
    box.className = `cm-md-level cm-md-level-${this.level}`
    box.setAttribute('aria-hidden', 'true')
    const label = document.createElement('span')
    label.textContent = `H${this.level}`
    box.appendChild(label)
    return box
  }
}

const LEVELS = [1, 2, 3, 4, 5, 6].map((level) => new HeadingLevel(level))

function headingLevels(view: EditorView): RangeSet<GutterMarker> {
  const { state } = view
  if (!isLive(state)) return RangeSet.empty
  const markers: Array<Range<GutterMarker>> = []
  for (const { from, to } of view.visibleRanges)
    syntaxTree(state).iterate({
      from,
      to,
      enter: ({ name, node }) => {
        if (SKIP.has(name)) return false
        const level = /^ATXHeading([1-6])$/.exec(name)?.[1]
        if (!level) return undefined
        const line = state.doc.lineAt(node.from)
        // On its line the `#` marks show, and say the level themselves.
        if (!touched(state, line.from, line.to))
          markers.push(LEVELS[Number(level) - 1].range(line.from))
        return false
      },
    })
  return RangeSet.of(markers, true)
}

const livePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = liveDecorations(view)
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        treeChanged(update) ||
        liveChanged(update)
      )
        this.decorations = liveDecorations(update.view)
    }
  },
  { decorations: (plugin) => plugin.decorations },
)

export function markdownLivePreview(): Extension {
  return [
    markdownLive,
    livePlugin,
    gutter({ class: 'cm-md-levels', markers: headingLevels }),
    EditorView.baseTheme({
      '.cm-md-levels .cm-gutterElement': { padding: '0 4px 0 8px' },
      // The box takes the heading's size so its line box, and the label
      // centred in it, lines up with the heading's first line.
      '.cm-md-level': {
        display: 'block',
        textAlign: 'right',
        fontFamily: 'var(--font-mono)',
        color: 'var(--muted-foreground)',
      },
      '.cm-md-level-1': { fontSize: '1.5em' },
      '.cm-md-level-2': { fontSize: '1.3em' },
      '.cm-md-level-3': { fontSize: '1.15em' },
      '.cm-md-level > span': {
        fontSize: '10px',
        verticalAlign: 'middle',
        letterSpacing: '0.02em',
      },
      '.cm-md-bullet': { color: 'var(--muted-foreground)' },
      '.cm-md-task': {
        margin: '0 0.5em 0 0',
        verticalAlign: '-0.1em',
        accentColor: 'var(--foreground)',
        cursor: 'pointer',
      },
      '.cm-md-rule': {
        display: 'inline-block',
        width: '100%',
        verticalAlign: 'middle',
        borderTop: '1px solid var(--border)',
      },
    }),
  ]
}
