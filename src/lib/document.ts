// One entry point for language-specific work, so the editor, tree and
// actions treat XML and JSON files the same way.

import { isFlatFile, parseFlat } from './flat/parse'
import { addJsonChild, removeJsonNode, setJsonValue } from './json/edit'
import { formatJson } from './json/format'
import { parseJson } from './json/parse'
import { defaultChanges } from './xml/defaults'
import { addChild, removeNode, setText } from './xml/edit'
import { formatXml } from './xml/format'
import { elementByPath } from './xml/locate'
import { isElement } from './xml/model'
import { parseXml } from './xml/parse'
import { formatSql } from './sql/format'
import type { DefaultRule } from './xml/defaults'
import type { TextChange } from './xml/edit'
import type { FormatOptions, FormatResult } from './xml/format'
import type { DocLanguage, XmlDocument, XmlElement } from './xml/model'

export type { DocLanguage }

/** Extensions read as each language, the file pickers' list included. */
export const LANGUAGE_EXTENSIONS = {
  xml: [
    '.xml',
    '.xsd',
    '.xsl',
    '.xslt',
    '.wsdl',
    '.svg',
    '.plist',
    '.config',
    '.csproj',
    '.xaml',
    '.rss',
    '.atom',
    '.kml',
    '.gpx',
  ],
  json: ['.json', '.geojson', '.jsonld', '.webmanifest', '.har', '.ipynb'],
  flat: ['.txt', '.dat'],
  sql: ['.sql', '.ddl', '.dml'],
  zpl: ['.zpl'],
} as const satisfies Record<DocLanguage, ReadonlyArray<`.${string}`>>

const extensionPattern = (extensions: ReadonlyArray<string>) =>
  new RegExp(`(${extensions.map((ext) => `\\${ext}`).join('|')})$`, 'i')

const JSON_EXT = extensionPattern(LANGUAGE_EXTENSIONS.json)
const XML_EXT = extensionPattern(LANGUAGE_EXTENSIONS.xml)
const SQL_EXT = extensionPattern(LANGUAGE_EXTENSIONS.sql)
const ZPL_EXT = extensionPattern(LANGUAGE_EXTENSIONS.zpl)
const ZPL_START = /^\s*[\^~][A-Z][A-Z0-9@]/i
const FLAT_EXT = extensionPattern(LANGUAGE_EXTENSIONS.flat)
// A statement keyword first, after any leading comments.
const SQL_START =
  /^(\s*(--[^\n]*|\/\*[\s\S]*?\*\/))*\s*(select|with|insert|update|delete|merge|create|alter|drop|truncate)\b/i

/** By extension, else by the first character of the content. */
export function languageOf(name: string, content: string): DocLanguage {
  // A flat file is never valid XML or JSON, so its content beats the name.
  if (isFlatFile(content)) return 'flat'
  if (ZPL_EXT.test(name)) return 'zpl'
  if (JSON_EXT.test(name)) return 'json'
  if (XML_EXT.test(name)) return 'xml'
  if (SQL_EXT.test(name)) return 'sql'
  if (ZPL_START.test(content)) return 'zpl'
  if (SQL_START.test(content)) return 'sql'
  return /^\s*[[{]/.test(content) ? 'json' : 'xml'
}

/** The language `content` reads as on its own, or null when nothing gives it away. */
export function detectLanguage(content: string): DocLanguage | null {
  if (isFlatFile(content)) return 'flat'
  if (/^\s*[[{]/.test(content)) return 'json'
  if (/^\s*</.test(content)) return 'xml'
  if (ZPL_START.test(content)) return 'zpl'
  if (SQL_START.test(content)) return 'sql'
  return null
}

/** A file name without the extension that gives its type. */
export function untypedName(name: string) {
  for (const ext of [JSON_EXT, XML_EXT, SQL_EXT, FLAT_EXT, ZPL_EXT]) {
    const stem = name.replace(ext, '')
    if (stem !== name) return stem || name
  }
  return name
}

const EXTENSIONS: Record<DocLanguage, string> = {
  xml: '.xml',
  json: '.json',
  flat: '.txt',
  sql: '.sql',
  zpl: '.zpl',
}

/** `name` with the extension of `language`, unless it already reads as one. */
export function typedName(name: string, language: DocLanguage) {
  const keep =
    (language === 'json' && JSON_EXT.test(name)) ||
    (language === 'xml' && XML_EXT.test(name)) ||
    (language === 'flat' && FLAT_EXT.test(name)) ||
    (language === 'sql' && SQL_EXT.test(name)) ||
    (language === 'zpl' && ZPL_EXT.test(name))
  return keep ? name : untypedName(name) + EXTENSIONS[language]
}

export function parseDocument(
  text: string,
  language: DocLanguage,
): XmlDocument {
  if (language === 'flat' || language === 'sql' || language === 'zpl') {
    return {
      language,
      nodes: [],
      root: null,
      errors: [],
      ...(language === 'flat' && { flat: parseFlat(text) }),
    }
  }
  return language === 'json' ? parseJson(text) : parseXml(text)
}

export function formatDocument(
  text: string,
  language: DocLanguage,
  options: FormatOptions,
): FormatResult {
  // Fixed-width fields are already aligned.
  if (language === 'flat' || language === 'zpl') return { ok: true, text }
  if (language === 'sql') return { ok: true, text: formatSql(text) }
  return language === 'json'
    ? formatJson(text, options)
    : formatXml(text, options)
}

export function setValue(el: XmlElement, value: string): Array<TextChange> {
  return el.json ? setJsonValue(el, value) : setText(el, value)
}

/** Whether `addChildTo` can add anything to `el`. */
export function canAddChild(el: XmlElement) {
  return !el.json || el.json.type === 'object' || el.json.type === 'array'
}

export function addChildTo(
  text: string,
  el: XmlElement,
  name: string,
): Array<TextChange> {
  return el.json ? addJsonChild(text, el, name) : addChild(text, el, name)
}

export function removeElement(
  text: string,
  el: XmlElement,
  doc: XmlDocument,
): Array<TextChange> {
  if (!el.json) return removeNode(text, el)
  const parentPath = el.path.slice(0, el.path.lastIndexOf('/'))
  const level = parentPath
    ? (elementByPath(doc.nodes, parentPath)?.children ?? [])
    : doc.nodes
  return removeJsonNode(text, el, level.filter(isElement))
}

export function documentDefaults(
  doc: XmlDocument,
  rules: ReadonlyArray<DefaultRule>,
) {
  return defaultChanges(doc.nodes, rules, setValue)
}

export const MIME_TYPES: Record<DocLanguage, string> = {
  xml: 'application/xml',
  json: 'application/json',
  flat: 'text/plain',
  sql: 'application/sql',
  zpl: 'application/octet-stream',
}
