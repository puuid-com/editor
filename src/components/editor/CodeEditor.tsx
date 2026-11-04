import { EditorView } from '@codemirror/view'
import { useEffect, useRef } from 'react'

import { notify } from '#/components/app/notice-store'
import { askPasteChoice } from '#/components/app/paste'
import {
  applyDefaultsActive,
  formatActive,
  highlightAtCursor,
  resolveVarsActive,
} from './actions'
import { saveActive, saveActiveAs } from './disk'
import {
  parseActive,
  getView,
  registerFileView,
  publishCursor,
  publishParse,
  setView,
} from './editor-store'
import { createEditorSession, remoteSync } from './editor-session'
import { setVarValues } from './dynamic-vars'
import { editorExtensions, setDefaultRules, fileIdField } from './extensions'
import { setLongValueLimit } from './long-values'
import { setZplTags } from './zpl-links'
import { setTagHighlights } from './tag-highlights'
import { TagContextMenu } from './TagContextMenu'
import { editorPrefs, setWordWrap } from './word-wrap'
import { useEnabledDefaults } from '#/hooks/use-defaults'
import { useHighlightMap } from '#/hooks/use-highlights'
import { useFormatSettings } from '#/hooks/use-profiles'
import { useVariableValues } from '#/hooks/use-variables'
import { shortcuts } from '#/lib/shortcuts'
import { sessionStore, setActive } from '#/lib/store/session'
import { useSelector } from '@tanstack/react-store'
import { parseDocument } from '#/lib/document'
import { docLanguage } from './language'
import { saveContent } from '#/lib/store/files'
import { m } from '#/paraglide/messages'
import type { EditorState, Extension } from '@codemirror/state'
import type { DefaultRule } from '#/lib/xml/defaults'

function publishCursorFrom(state: EditorState) {
  const pos = state.selection.main.head
  const line = state.doc.lineAt(pos)
  publishCursor(pos, line.number, pos - line.from + 1)
}

let extensions: Extension | null = null

function sharedExtensions(
  highlights: ReadonlyMap<string, string>,
  defaults: ReadonlyArray<DefaultRule>,
  values: ReadonlyMap<string, string>,
  shortenAt: number,
) {
  extensions ??= editorExtensions(
    {
      onParse: (fileId, doc) => {
        if (sessionStore.state.activeId === fileId) publishParse(fileId, doc)
      },
      onChange: (fileId, update) => {
        if (update.transactions.some((tr) => tr.annotation(remoteSync))) return
        saveContent({ id: fileId, content: update.state.doc.toString() })
      },
      onCursor: (update) => {
        if (getView() === update.view) publishCursorFrom(update.state)
      },
      onPasteWhole: askPasteChoice,
      keys: [
        { key: shortcuts.format.key, run: formatActive, preventDefault: true },
        { key: shortcuts.save.key, run: saveActive, preventDefault: true },
        { key: shortcuts.saveAs.key, run: saveActiveAs, preventDefault: true },
        {
          key: shortcuts.highlight.key,
          run: highlightAtCursor,
          preventDefault: true,
        },
        {
          key: shortcuts.applyDefaults.key,
          run: applyDefaultsActive,
          preventDefault: true,
        },
        {
          key: shortcuts.resolveVars.key,
          run: resolveVarsActive,
          preventDefault: true,
        },
      ],
    },
    highlights,
    defaults,
    values,
    shortenAt,
  )
  return extensions
}

export function CodeEditor({ fileId }: { fileId: string }) {
  const active = useSelector(sessionStore, (s) => s.activeId === fileId)
  const parentRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const highlights = useHighlightMap(fileId)
  const highlightsRef = useRef(highlights)
  const defaults = useEnabledDefaults(fileId)
  const defaultsRef = useRef(defaults)
  const values = useVariableValues(fileId)
  const valuesRef = useRef(values)
  const format = useFormatSettings(fileId)
  const shortenAt = format.shortenValues ? format.shortenAt : 0
  const shortenAtRef = useRef(shortenAt)
  const zplTags = format.zplTags
  const zplTagsRef = useRef(zplTags)
  const wrap = useSelector(editorPrefs, (s) => s.wordWrap)
  const wrapRef = useRef(wrap)
  const sessionRef = useRef<ReturnType<typeof createEditorSession> | null>(null)

  useEffect(() => {
    const view = new EditorView({ parent: parentRef.current! })
    viewRef.current = view
    // Focus selects the global command target; other panes keep their own view.

    const session = createEditorSession(view, {
      onRemoteChange: (file) =>
        notify.info(m.updated_elsewhere({ name: file.name })),
      onLanguageChange: (id) => {
        if (getView() === view) publishParse(id, parseActive())
      },
    })
    sessionRef.current = session

    return () => {
      const id = view.state.field(fileIdField, false)
      if (id) registerFileView(id, null)
      session.dispose()
      sessionRef.current = null
      view.destroy()
      viewRef.current = null
      if (getView() === view) setView(null)
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const opened = sessionRef.current?.open(
      fileId,
      sharedExtensions(
        highlightsRef.current,
        defaultsRef.current,
        valuesRef.current,
        shortenAtRef.current,
      ),
    )
    if (!opened) return
    registerFileView(fileId, view)
    view.dispatch({
      effects: [
        setTagHighlights(highlightsRef.current),
        setDefaultRules(defaultsRef.current),
        setVarValues(valuesRef.current),
        setLongValueLimit(shortenAtRef.current),
        setZplTags(zplTagsRef.current),
        setWordWrap(wrapRef.current),
      ],
    })
    if (sessionStore.state.activeId === fileId) {
      setView(view)
      publishCursorFrom(view.state)
      publishParse(fileId, parseActive())
    }
  }, [fileId])

  const activate = () => {
    const view = viewRef.current
    if (!view || !view.state.field(fileIdField, false)) return
    setActive(fileId)
    setView(view)
    publishCursorFrom(view.state)
    publishParse(
      fileId,
      parseDocument(view.state.doc.toString(), view.state.facet(docLanguage)),
    )
  }
  useEffect(() => {
    if (active) activate()
  }, [active, fileId])

  useEffect(() => {
    highlightsRef.current = highlights
    viewRef.current?.dispatch({ effects: setTagHighlights(highlights) })
  }, [highlights])

  useEffect(() => {
    defaultsRef.current = defaults
    viewRef.current?.dispatch({ effects: setDefaultRules(defaults) })
  }, [defaults])

  useEffect(() => {
    valuesRef.current = values
    viewRef.current?.dispatch({ effects: setVarValues(values) })
  }, [values])

  useEffect(() => {
    shortenAtRef.current = shortenAt
    viewRef.current?.dispatch({ effects: setLongValueLimit(shortenAt) })
  }, [shortenAt])

  useEffect(() => {
    zplTagsRef.current = zplTags
    viewRef.current?.dispatch({ effects: setZplTags(zplTags) })
  }, [zplTags])

  useEffect(() => {
    wrapRef.current = wrap
    viewRef.current?.dispatch({ effects: setWordWrap(wrap) })
  }, [wrap])

  return (
    <TagContextMenu>
      <div
        onFocusCapture={activate}
        onPointerDownCapture={activate}
        ref={parentRef}
        className="h-full min-h-0 overflow-hidden"
      />
    </TagContextMenu>
  )
}
