import { parser } from '@lezer/markdown'
import type { LintError } from 'markdownlint'
import type { Plugin } from 'prettier'

import { formatSql } from './sql/format'
import { formatXml } from './xml/format'

type Formatter = (code: string) => Promise<string>

/** Prettier with only the grammars `parser` needs, loaded on first use. */
function prettier(
  name: string,
  plugins: () => Array<Promise<{ default: Plugin } | Plugin>>,
): Formatter {
  return async (code) => {
    const [{ format }, ...loaded] = await Promise.all([
      import('prettier/standalone'),
      ...plugins(),
    ])
    return format(code, {
      parser: name,
      plugins: loaded.map((mod) => ('default' in mod ? mod.default : mod)),
    })
  }
}

const estree = () => import('prettier/plugins/estree')
const babel = prettier('babel', () => [
  import('prettier/plugins/babel'),
  estree(),
])
const typescript = prettier('typescript', () => [
  import('prettier/plugins/typescript'),
  estree(),
])
const json = prettier('json', () => [
  import('prettier/plugins/babel'),
  estree(),
])
const css = (name: string) =>
  prettier(name, () => [import('prettier/plugins/postcss')])
const yaml = prettier('yaml', () => [import('prettier/plugins/yaml')])
const graphql = prettier('graphql', () => [import('prettier/plugins/graphql')])
const html = prettier('html', () => [
  import('prettier/plugins/html'),
  import('prettier/plugins/postcss'),
  import('prettier/plugins/babel'),
  estree(),
])

const xml: Formatter = async (code) => {
  const result = formatXml(code)
  if (!result.ok) throw new Error(result.errors[0]?.message)
  return result.text
}
const sql: Formatter = async (code) => formatSql(code, '  ')

/** The fence languages Format reads, by the names people give them. */
const FORMATTERS: Record<string, Formatter> = {
  js: babel,
  javascript: babel,
  jsx: babel,
  mjs: babel,
  cjs: babel,
  ts: typescript,
  typescript,
  tsx: typescript,
  mts: typescript,
  cts: typescript,
  json,
  jsonc: json,
  json5: json,
  css: css('css'),
  scss: css('scss'),
  less: css('less'),
  yaml,
  yml: yaml,
  graphql,
  gql: graphql,
  html,
  xml,
  svg: xml,
  sql,
}

/**
 * Formats the code inside each fenced block, in the languages above, and
 * leaves the prose as written. A block that doesn't parse stays as it is
 * and counts in `skipped`.
 */
export async function formatMarkdownCode(text: string) {
  const tree = parser.parse(text)
  const blocks: Array<{
    from: number
    to: number
    indent: number
    format: Formatter
  }> = []
  tree.iterate({
    enter: (node) => {
      // Quoted code would need its `>` markers kept on every line.
      if (node.name === 'Blockquote') return false
      if (node.name !== 'FencedCode') return
      const marks = node.node.getChildren('CodeMark')
      const info = node.node.getChild('CodeInfo')
      const word = info
        ? text.slice(info.from, info.to).trim().split(/\s/)[0].toLowerCase()
        : ''
      const format = FORMATTERS[word] as Formatter | undefined
      if (marks.length < 2 || !format) return false
      const open = marks[0]
      const close = marks[marks.length - 1]
      const from = text.indexOf('\n', open.to) + 1
      const to = text.lastIndexOf('\n', close.from) + 1
      const indent = node.from - (text.lastIndexOf('\n', node.from - 1) + 1)
      if (from > 0 && to > from) blocks.push({ from, to, indent, format })
      return false
    },
  })

  let skipped = 0
  let out = text
  // From the end, so earlier offsets stay valid.
  for (const { from, to, indent, format } of blocks.reverse()) {
    const pad = ' '.repeat(indent)
    const strip = new RegExp(`^ {0,${indent}}`)
    const code = text
      .slice(from, to - 1)
      .split('\n')
      .map((line) => line.replace(strip, ''))
      .join('\n')
    try {
      const formatted = (await format(code)).replace(/\s+$/, '')
      const lines = formatted
        .split('\n')
        .map((line) => (line ? pad + line : line))
      out = out.slice(0, from) + lines.join('\n') + '\n' + out.slice(to)
    } catch {
      skipped++
    }
  }
  return { text: out, skipped }
}

/**
 * Turns underlined headings into `#` ones, the style most guides ask for and
 * the one markdownlint expects when a file mixes them.
 */
export function atxHeadings(text: string): string {
  // Front matter's closing `---` would read as an underline.
  const front = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(text)?.[0] ?? ''
  if (front) return front + atxHeadings(text.slice(front.length))
  const headings: Array<{ from: number; to: number; level: number }> = []
  parser.parse(text).iterate({
    enter: (node) => {
      const level = { SetextHeading1: 1, SetextHeading2: 2 }[node.name]
      if (level) headings.push({ from: node.from, to: node.to, level })
      return !['SetextHeading1', 'SetextHeading2', 'Blockquote'].includes(
        node.name,
      )
    },
  })
  let out = text
  for (const { from, to, level } of headings.reverse()) {
    const lines = text.slice(from, to).split('\n').slice(0, -1)
    const title = lines.map((line) => line.trim()).join(' ')
    out = out.slice(0, from) + '#'.repeat(level) + ' ' + title + out.slice(to)
  }
  return out
}

/**
 * Lays out the prose the way Prettier does, without rewrapping lines: `#`
 * headings, `-` bullets, `_emphasis_` and `**strong**`, one blank line
 * between blocks, aligned tables and no trailing spaces.
 */
const prose: Formatter = async (code) => {
  const [{ format }, markdown] = await Promise.all([
    import('prettier/standalone'),
    import('prettier/plugins/markdown'),
  ])
  return format(code, {
    parser: 'markdown',
    plugins: [markdown],
    proseWrap: 'preserve',
  })
}

/**
 * Applies the fixes markdownlint knows for its rules, with its Prettier
 * style so they don't undo the layout: bare URLs in `<>`, for one. Unused
 * link definitions stay: removing them would lose what was written.
 */
async function lintFixes(text: string) {
  const [{ lint }, { applyFixes }, style] = await Promise.all([
    import('markdownlint/promise'),
    import('markdownlint'),
    import('markdownlint/style/prettier'),
  ])
  const results = await lint({
    strings: { doc: text },
    config: { ...style.default, 'link-image-reference-definitions': false },
  })
  const errors: Array<LintError> = results.doc
  return applyFixes(text, errors)
}

/**
 * Formats a Markdown file to the common standards: the code in its fences
 * as above, then the prose as Prettier lays it out and with markdownlint's
 * fixes. If the prose can't be laid out, only the code is formatted.
 */
export async function formatMarkdown(text: string) {
  const code = await formatMarkdownCode(text)
  try {
    return {
      text: await lintFixes(await prose(atxHeadings(code.text))),
      skipped: code.skipped,
    }
  } catch {
    return code
  }
}
