import {
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
} from '@codemirror/language'
import { Compartment, Facet } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { tags } from '@lezer/highlight'

interface ZplTokenState {
  /** Inside ^FD/^FV field data or a ^FX comment, which run until the next command. */
  body: 'data' | 'comment' | null
}

const zplStreamLanguage = StreamLanguage.define<ZplTokenState>({
  name: 'zpl',
  startState: () => ({ body: null }),
  token(stream, state) {
    if (stream.eatSpace()) return null

    const next = stream.peek()
    if (next === '^' || next === '~') {
      stream.next()
      // Every command is a prefix plus two characters (^FO, ^A0, ~DG, …).
      const code = (stream.next() ?? '') + (stream.next() ?? '')
      const upper = code.toUpperCase()
      state.body =
        upper === 'FD' || upper === 'FV'
          ? 'data'
          : upper === 'FX'
            ? 'comment'
            : null
      return 'keyword'
    }

    stream.eatWhile((char) => char !== '^' && char !== '~')
    if (state.body === 'data') return 'string'
    if (state.body === 'comment') return 'comment'
    return 'number'
  },
})

const zplHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--sql-keyword)', fontWeight: '600' },
  { tag: tags.number, color: 'var(--sql-number)' },
  { tag: tags.string, color: 'var(--sql-string)' },
  { tag: tags.comment, color: 'var(--sql-comment)', fontStyle: 'italic' },
])

/** The printer dpi the explanations convert dots to inches with. */
export const labelDpi = Facet.define<number, number>({
  combine: (values) => values.at(-1) ?? 203,
})

/** Whether each line ends with a note saying what it does. */
export const explainLines = Facet.define<boolean, boolean>({
  combine: (values) => values.at(-1) ?? true,
})

/** The parts of the language that depend on the panel's settings. */
export function zplHelp({
  dpi,
  explain,
}: {
  dpi: number
  explain: boolean
}): Extension {
  return [labelDpi.of(dpi), explainLines.of(explain)]
}

// The explanations read each command through the label parser, which is far
// larger than the rest of the editor. It loads the first time a ZPL file
// shows, so files of every other type never pay for it.
let explanations: Promise<Extension> | undefined

/** Starts fetching the command explanations, once. */
export function loadZplExplanations() {
  return (explanations ??= import('./zpl-help').then(
    (mod) => mod.zplExplain,
    (error: unknown) => {
      // Offline, say: the next ZPL file to show tries again.
      explanations = undefined
      throw error
    },
  ))
}

const explainSlot = new Compartment()

/** Puts the explanations in the editor once they have loaded. */
const explainLoader = ViewPlugin.fromClass(
  class {
    destroyed = false

    constructor(view: EditorView) {
      void loadZplExplanations().then(
        (explain) => {
          // Gone with a file switch, or already in a state that was kept.
          if (this.destroyed || explainSlot.get(view.state) === explain) return
          view.dispatch({ effects: explainSlot.reconfigure(explain) })
        },
        // The file still edits, without its explanations.
        () => undefined,
      )
    }

    destroy() {
      this.destroyed = true
    }
  },
)

const MONO_FONT = 'var(--font-mono)'
const SANS_FONT = "'Geist Variable', ui-sans-serif, system-ui, sans-serif"

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    color: 'var(--foreground)',
    backgroundColor: 'var(--background)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: MONO_FONT,
    lineHeight: '1.6',
    overscrollBehavior: 'none',
  },
  '.cm-content': { caretColor: 'var(--foreground)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--foreground)' },
  '.cm-gutters': {
    color: 'var(--muted-foreground)',
    backgroundColor: 'var(--background)',
    border: 'none',
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in oklch, var(--muted) 70%, transparent)',
  },
  '.cm-activeLineGutter': {
    color: 'var(--foreground)',
    backgroundColor: 'transparent',
  },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground':
    { backgroundColor: 'var(--accent)' },
  '.cm-tooltip': {
    color: 'var(--popover-foreground)',
    backgroundColor: 'var(--popover)',
    border: '1px solid var(--border)',
    fontFamily: SANS_FONT,
    fontSize: '12px',
  },
  '.cm-zpl-command-tooltip': {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    maxWidth: '340px',
    padding: '8px 10px',
    lineHeight: '1.45',
  },
  '.cm-zpl-command-tooltip p': { margin: '0' },
  '.cm-zpl-tooltip-parameters': {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    columnGap: '10px',
    margin: '0',
    paddingTop: '6px',
    borderTop: '1px solid var(--border)',
  },
  '.cm-zpl-tooltip-parameters > div': {
    display: 'grid',
    gridColumn: '1 / -1',
    gridTemplateColumns: 'subgrid',
    padding: '1px 4px',
    margin: '0 -4px',
  },
  '.cm-zpl-tooltip-parameters dt': { color: 'var(--muted-foreground)' },
  '.cm-zpl-tooltip-parameters dd': { margin: '0' },
  '.cm-zpl-tooltip-parameters code': {
    fontFamily: MONO_FONT,
    fontWeight: '600',
  },
  '.cm-zpl-tooltip-active': { backgroundColor: 'var(--accent)' },
  '.cm-zpl-hint': {
    paddingLeft: '3ch',
    color: 'var(--muted-foreground)',
    fontFamily: SANS_FONT,
    fontSize: '12px',
    userSelect: 'none',
    pointerEvents: 'none',
  },
  '.cm-tooltip-lint': { padding: '0' },
  '.cm-diagnostic': { padding: '6px 8px' },
})

export function zpl(): Extension {
  return [
    zplStreamLanguage,
    syntaxHighlighting(zplHighlightStyle),
    editorTheme,
    explainSlot.of([]),
    explainLoader,
  ]
}
