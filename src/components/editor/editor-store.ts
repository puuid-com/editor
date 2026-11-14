import { Store } from '@tanstack/store'
import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

import { docLanguage } from './language'
import { parseEditor } from './parse'
import { parseDocument } from '#/lib/document'
import { elementAt, elementByPath } from '#/lib/xml/locate'
import type { TextChange } from '#/lib/xml/edit'
import type { XmlDocument, XmlElement } from '#/lib/xml/model'

// Bridges the CodeMirror view and the rest of the app: the parsed document,
// the cursor, and which tree node is selected. The view itself lives outside
// React state; components reach it through the helpers below.

interface EditorSnapshot {
  fileId: string | null
  /** Latest parse of the active document (error tolerant). */
  doc: XmlDocument
  /** Bumps on every parse so subscribers can cheaply detect changes. */
  revision: number
  pos: number
  line: number
  /** Element under the cursor, selected in the tree. */
  selectedPath: string | null
}

const emptyDoc: XmlDocument = {
  language: 'xml',
  nodes: [],
  root: null,
  errors: [],
}

const noFile: EditorSnapshot = {
  fileId: null,
  doc: emptyDoc,
  revision: 0,
  pos: 0,
  line: 1,
  selectedPath: null,
}

export const editorStore = new Store<EditorSnapshot>(noFile)

let currentView: EditorView | null = null

/**
 * Attaches the editor's view, or detaches it when the editor goes away. Its
 * document goes too, so the status bar doesn't act on a closed file.
 */
export function setView(view: EditorView | null) {
  currentView = view
  if (view) return
  // The revision keeps counting, so caches keyed by it never match old text.
  editorStore.setState((s) => ({ ...noFile, revision: s.revision + 1 }))
}

export function getView() {
  return currentView
}

function pathAt(doc: XmlDocument, pos: number) {
  return elementAt(doc.nodes, pos)?.path ?? null
}

export function publishParse(fileId: string, doc: XmlDocument) {
  if (editorStore.state.fileId === fileId && editorStore.state.doc === doc)
    return
  editorStore.setState((s) => ({
    ...s,
    fileId,
    doc,
    revision: s.revision + 1,
    selectedPath: pathAt(doc, s.pos),
  }))
}

export function publishCursor(pos: number, line: number) {
  editorStore.setState((s) =>
    s.pos === pos && s.line === line
      ? s
      : { ...s, pos, line, selectedPath: pathAt(s.doc, pos) },
  )
}

/** Applies structure-tree edits as one undoable transaction. */
function applyChanges(changes: Array<TextChange>) {
  const view = currentView
  if (!view || changes.length === 0) return
  view.dispatch({ changes, userEvent: 'input.tree' })
}

/**
 * Edits the element at `path`. Positions are resolved against a fresh parse,
 * so rapid edits never act on a stale tree.
 */
export function editAtPath(
  path: string,
  build: (el: XmlElement, text: string, doc: XmlDocument) => Array<TextChange>,
) {
  const view = currentView
  if (!view) return
  const text = view.state.doc.toString()
  const doc = parseActive()
  const el = elementByPath(doc.nodes, path)
  if (!el) return
  applyChanges(build(el, text, doc))
  const fileId = editorStore.state.fileId
  if (fileId) publishParse(fileId, parseActive())
}

/** Parses `text` as the language of the file in the editor. */
export function parseActive(text?: string) {
  return text === undefined && currentView
    ? parseEditor(currentView)
    : parseDocument(text ?? '', activeLanguage())
}

export function activeLanguage() {
  return currentView?.state.facet(docLanguage) ?? 'xml'
}

/** Selects an element's open tag without stealing focus from the panel. */
export function revealElement(el: XmlElement, focus = false) {
  // Head at the start, so the cursor sits inside this element.
  revealRange(el.openTo, el.from, focus)
}

/** Moves the cursor to a range and scrolls it into view. */
export function revealRange(from: number, to = from, focus = true) {
  const view = currentView
  if (!view) return
  const max = view.state.doc.length
  view.dispatch({
    selection: EditorSelection.single(Math.min(from, max), Math.min(to, max)),
    scrollIntoView: true,
    userEvent: 'select.reveal',
  })
  if (focus) view.focus()
}

export function getText() {
  return currentView?.state.doc.toString() ?? ''
}

const views = new Map<string, EditorView>()
// The file each view shows now. A pane's view moves from file to file, so
// `views` can still point an earlier file at it.
const shown = new WeakMap<EditorView, string>()
let pendingFocus: { fileId: string; until: number } | null = null

export function registerFileView(fileId: string, view: EditorView | null) {
  if (!view) {
    const previous = views.get(fileId)
    if (previous) shown.delete(previous)
    views.delete(fileId)
    return
  }
  const previous = shown.get(view)
  if (previous) views.delete(previous)
  const replaced = views.get(fileId)
  if (replaced) shown.delete(replaced)
  views.set(fileId, view)
  shown.set(view, fileId)
  if (pendingFocus?.fileId === fileId) {
    if (Date.now() < pendingFocus.until) view.focus()
    pendingFocus = null
  }
}

/**
 * Focuses a file's editor. When it's still loading, as when a click opens a
 * file in a pane of another type, it takes focus once it's there, if that is
 * within a moment.
 */
export function focusFileView(fileId: string) {
  const view = getFileView(fileId)
  if (view?.dom.isConnected) {
    pendingFocus = null
    view.focus()
  } else pendingFocus = { fileId, until: Date.now() + 1500 }
}

/** The editor showing a file now, if one does. */
export function getFileView(fileId: string) {
  const view = views.get(fileId)
  return view && shown.get(view) === fileId ? view : undefined
}
