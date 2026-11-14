import { forceLinting } from '@codemirror/lint'
import { Annotation, EditorState, Transaction } from '@codemirror/state'

import { fileIdField } from './extensions'
import {
  docLanguage,
  languageCompartment,
  languageExtension,
  structureGutters,
} from './language'
import { languageOf } from '#/lib/document'
import { filesCollection } from '#/lib/store/files'
import { isOwnWriter, writerId } from '#/lib/store/session'
import { diffChange } from '#/lib/xml/edit'
import type { Extension, TransactionSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import type { DocLanguage } from '#/lib/document'
import type { XmlFile } from '#/lib/store/files'
import type { TextChange } from '#/lib/xml/edit'

/** Prevents synchronized changes from being saved back to the collection. */
export const remoteSync = Annotation.define<boolean>()

function remoteChange(changes: TextChange): TransactionSpec {
  return {
    changes,
    annotations: [remoteSync.of(true), Transaction.addToHistory.of(false)],
  }
}

/** Already saved, but made here, such as by a backup restore: undoable. */
function ownChange(changes: TextChange): TransactionSpec {
  return {
    changes,
    annotations: [remoteSync.of(true), Transaction.userEvent.of('input.sync')],
  }
}

// Keep undo history and selection across file switches and editor remounts.
const states = new Map<string, EditorState>()

/** Forgets a file's editor state after deleting or archiving it. */
export function dropEditorState(fileId: string) {
  states.delete(fileId)
}

/** The language and the gutters that only make sense for it. */
function editorLanguage(language: DocLanguage) {
  return [languageExtension(language), structureGutters(language)]
}

/**
 * Switches the editor to the language `content` reads as. `content` is the
 * text the view shows, which callers already hold: serializing the view's
 * document on each keystroke costs a copy of the whole file.
 */
function syncLanguage(view: EditorView, name: string, content: string) {
  const language = languageOf(name, content)
  if (view.state.facet(docLanguage) === language) return false
  view.dispatch({
    effects: languageCompartment.reconfigure(editorLanguage(language)),
  })
  forceLinting(view)
  return true
}

/** Owns file switching and collection synchronization for one editor view. */
export function createEditorSession(
  view: EditorView,
  callbacks: {
    onRemoteChange: (file: XmlFile) => void
    onLanguageChange: (fileId: string) => void
  },
) {
  let fileExtensions: Extension | null = null

  function createState(
    fileId: string,
    file: XmlFile | undefined,
    extensions: Extension,
  ) {
    const content = file?.content ?? ''
    return EditorState.create({
      doc: content,
      extensions: [
        fileIdField.init(() => fileId),
        languageCompartment.of(
          editorLanguage(languageOf(file?.name ?? '', content)),
        ),
        extensions,
      ],
    })
  }

  const subscription = filesCollection.subscribeChanges(
    (changes) => {
      for (const change of changes) {
        if (change.type === 'delete') {
          dropEditorState(String(change.key))
          continue
        }
        const file = change.value
        const active = view.state.field(fileIdField, false) === file.id
        // What the view shows once this change is in: the row's text, unless
        // a later edit here hasn't reached the collection yet.
        let shown = file.content
        if (file.writer !== writerId) {
          const own = isOwnWriter(file.writer)
          const previous = change.previousValue
          // So this page's own edit can be undone in a file not opened yet.
          const state = active
            ? view.state
            : (states.get(file.id) ??
              (own && previous && fileExtensions
                ? createState(file.id, previous, fileExtensions)
                : undefined))
          const diff = state && diffChange(state.doc.toString(), file.content)
          if (state && diff) {
            const spec = own ? ownChange(diff) : remoteChange(diff)
            if (active) {
              view.dispatch(spec)
              if (!own) callbacks.onRemoteChange(file)
            } else {
              states.set(file.id, state.update(spec).state)
            }
          }
        } else if (active && view.state.doc.length !== file.content.length) {
          shown = view.state.doc.toString()
        }
        // Renames and edits can both change the language, such as pasting
        // a flat file into an XML one.
        if (active && syncLanguage(view, file.name, shown))
          callbacks.onLanguageChange(file.id)
      }
    },
    // open() reads the initial row. Explicit false preserves subsequent
    // updates/deletes instead of treating unseen rows as new insertions.
    { includeInitialState: false },
  )

  return {
    /** Returns false if this file is already open. */
    open(fileId: string, extensions: Extension) {
      fileExtensions = extensions
      const previous = view.state.field(fileIdField, false)
      if (previous === fileId) return false
      if (previous && filesCollection.has(previous))
        states.set(previous, view.state)

      const file = filesCollection.get(fileId)
      const content = file?.content ?? ''
      const cached = states.get(fileId)
      if (cached) {
        const diff = diffChange(cached.doc.toString(), content)
        view.setState(diff ? cached.update(remoteChange(diff)).state : cached)
      } else {
        view.setState(createState(fileId, file, extensions))
      }
      // A file may have been renamed while its editor state was cached.
      if (file) syncLanguage(view, file.name, content)
      return true
    },
    dispose() {
      subscription.unsubscribe()
      const id = view.state.field(fileIdField, false)
      if (id && filesCollection.has(id)) states.set(id, view.state)
    },
  }
}
