import { EditorView } from '@codemirror/view'
import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

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
import { replayDraftEdits } from './draft'
import { setVarValues } from './dynamic-vars'
import { editorExtensions, setDefaultRules, fileIdField } from './extensions'
import { imagePaste } from '#/components/markdown/image-paste'
import { liveImages } from '#/components/markdown/md-live-images'
import { setMarkdownLive } from '#/components/markdown/md-live'
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
import type { EditorState, Extension, StateEffect } from '@codemirror/state'
import type { DefaultRule } from '#/lib/xml/defaults'

function publishCursorFrom(state: EditorState) {
  const pos = state.selection.main.head
  publishCursor(pos, state.doc.lineAt(pos).number)
}

let extensions: Extension | null = null

function sharedExtensions(
  highlights: ReadonlyMap<string, string>,
  defaults: ReadonlyArray<DefaultRule>,
  values: ReadonlyMap<string, string>,
  shortenAt: number,
) {
  extensions ??= [
    imagePaste,
    liveImages,
    editorExtensions(
      {
        onParse: (fileId, doc) => {
          if (sessionStore.state.activeId === fileId) publishParse(fileId, doc)
        },
        onChange: (fileId, update) => {
          if (update.transactions.some((tr) => tr.annotation(remoteSync)))
            return
          saveContent({ id: fileId, content: update.state.doc.toString() })
        },
        onCursor: (update) => {
          if (getView() === update.view) publishCursorFrom(update.state)
        },
        onPasteWhole: askPasteChoice,
        keys: [
          {
            key: shortcuts.format.key,
            run: formatActive,
            preventDefault: true,
          },
          { key: shortcuts.save.key, run: saveActive, preventDefault: true },
          {
            key: shortcuts.saveAs.key,
            run: saveActiveAs,
            preventDefault: true,
          },
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
    ),
  ]
  return extensions
}

export function CodeEditor({ fileId }: { fileId: string }) {
  const active = useSelector(sessionStore, (s) => s.activeId === fileId)
  const parentRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const format = useFormatSettings(fileId)
  // The profile's settings, sent to the view as they change and again to
  // each file it opens.
  const highlights = useViewSetting(
    viewRef,
    useHighlightMap(fileId),
    setTagHighlights,
  )
  const defaults = useViewSetting(
    viewRef,
    useEnabledDefaults(fileId),
    setDefaultRules,
  )
  const values = useViewSetting(
    viewRef,
    useVariableValues(fileId),
    setVarValues,
  )
  const shortenAt = useViewSetting(
    viewRef,
    format.shortenValues ? format.shortenAt : 0,
    setLongValueLimit,
  )
  const zplTags = useViewSetting(viewRef, format.zplTags, setZplTags)
  const wrap = useViewSetting(
    viewRef,
    useSelector(editorPrefs, (s) => s.wordWrap),
    setWordWrap,
  )
  const live = useViewSetting(
    viewRef,
    useSelector(editorPrefs, (s) => s.markdownLive),
    (on) => setMarkdownLive.of(on),
  )
  const settings = [
    highlights,
    defaults,
    values,
    shortenAt,
    zplTags,
    wrap,
    live,
  ]
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
        highlights.value(),
        defaults.value(),
        values.value(),
        shortenAt.value(),
      ),
    )
    if (!opened) return
    registerFileView(fileId, view)
    view.dispatch({ effects: settings.map((setting) => setting.effect()) })
    if (sessionStore.state.activeId === fileId) {
      setView(view)
      publishCursorFrom(view.state)
      publishParse(fileId, parseActive())
    }
    // A file started in the draft takes over what was typed there.
    replayDraftEdits(fileId, view)
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

/**
 * Dispatches `toEffect(value)` to the view whenever `value` changes. The
 * latest value stays readable for views that open a file later.
 */
function useViewSetting<T>(
  viewRef: RefObject<EditorView | null>,
  value: T,
  toEffect: (value: T) => StateEffect<unknown>,
) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
    viewRef.current?.dispatch({ effects: toEffect(value) })
  }, [value])
  return {
    value: () => ref.current,
    effect: () => toEffect(ref.current),
  }
}
