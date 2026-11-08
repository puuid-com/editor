import { parser } from '@lezer/markdown'
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
