import { syntaxTree } from '@codemirror/language'
import { Prec } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view'

import { treeChanged } from './syntax'
import { classifySql } from '#/lib/sql/highlight'
import type { SqlRole, SqlToken, SqlTokenType } from '#/lib/sql/highlight'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'

// Colours SQL by what each word is: keywords, functions, tables, aliases and
// columns. The grammar only knows keywords from identifiers, so the roles
// come from reading the whole statement.

const TYPES: Record<string, SqlTokenType> = {
  Keyword: 'keyword',
  Type: 'type',
  Builtin: 'builtin',
  Identifier: 'identifier',
  QuotedIdentifier: 'identifier',
  String: 'string',
  Number: 'number',
  Bits: 'number',
  Bytes: 'number',
  Bool: 'literal',
  Null: 'literal',
  LineComment: 'comment',
  BlockComment: 'comment',
  Operator: 'operator',
  Punctuation: 'punct',
  '(': 'punct',
  ')': 'punct',
  '[': 'punct',
  ']': 'punct',
  '{': 'punct',
  '}': 'punct',
  ';': 'punct',
  '.': 'punct',
}

const MARKS = Object.fromEntries(
  (
    [
      'keyword',
      'function',
      'string',
      'number',
      'literal',
      'comment',
      'operator',
      'table',
      'alias',
      'column',
    ] satisfies Array<SqlRole>
  ).map((role) => [role, Decoration.mark({ class: `cm-sql-${role}` })]),
) as Record<SqlRole, Decoration>

function build(view: EditorView): DecorationSet {
  const { state } = view
  const tokens: Array<SqlToken> = []
  syntaxTree(state).iterate({
    enter(node) {
      const type = TYPES[node.name] as SqlTokenType | undefined
      if (!type) return
      tokens.push({
        type,
        text: state.sliceDoc(node.from, node.to),
        from: node.from,
        to: node.to,
      })
      return false
    },
  })
  return Decoration.set(
    classifySql(tokens).map((m) => MARKS[m.role].range(m.from, m.to)),
    true,
  )
}

/** Role colours for SQL, innermost so they win over the generic syntax style. */
export const sqlHighlight = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = build(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || treeChanged(update))
        this.decorations = build(update.view)
    }
  },
  {
    provide: (plugin) =>
      Prec.highest(
        EditorView.decorations.of(
          (view) => view.plugin(plugin)?.decorations ?? Decoration.none,
        ),
      ),
  },
)
