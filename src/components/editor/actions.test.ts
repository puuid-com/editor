import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  commitVarsPreview,
  formatActiveAsync,
  resolveVarsActive,
} from './actions'
import { parseActive, publishParse, setView } from './editor-store'
import { docLanguage } from './language'
import { noticeStore } from '#/components/app/notice-store'
import { setVarsPreview, uiStore } from '#/components/app/ui-store'
import { formatMarkdown } from '#/lib/markdown-format'
import { createFile, filesCollection } from '#/lib/store/files'
import { settleWrites } from '#/lib/store/persist'
import { workspaceReady } from '#/lib/store/workspace'
import type { DocLanguage } from '#/lib/document'

vi.mock('@faker-js/faker', () => ({ faker: {} }))
vi.mock('#/lib/markdown-format', () => ({ formatMarkdown: vi.fn() }))

beforeAll(() => workspaceReady())

const views: Array<EditorView> = []

afterEach(async () => {
  views.splice(0).forEach((view) => view.destroy())
  setView(null)
  setVarsPreview(null)
  vi.resetAllMocks()
  const ids = [...filesCollection.keys()]
  if (ids.length) await filesCollection.delete(ids).isPersisted.promise
  await settleWrites()
})

function activate(id: string, view: EditorView) {
  setView(view)
  publishParse(id, parseActive())
}

function editor(text: string, language: DocLanguage) {
  const file = createFile(`file.${language}`, text)
  const view = new EditorView({
    state: EditorState.create({
      doc: text,
      extensions: docLanguage.of(language),
    }),
  })
  views.push(view)
  activate(file.id, view)
  return { file, view }
}

describe('asynchronous editor commands', () => {
  it('does not format another file with identical text in the same view', async () => {
    const text = '#Title'
    const { view } = editor(text, 'md')
    let finish!: (result: { text: string; skipped: number }) => void
    vi.mocked(formatMarkdown).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const formatting = formatActiveAsync()
    // Cached states can share the same immutable text object.
    const other = createFile('other.md', text)
    activate(other.id, view)
    finish({ text: '# Title\n', skipped: 0 })
    await formatting
    expect(view.state.doc.toString()).toBe(text)
  })

  it('still formats an unchanged active document', async () => {
    const { view } = editor('#Title', 'md')
    vi.mocked(formatMarkdown).mockResolvedValue({
      text: '# Title\n',
      skipped: 0,
    })
    await formatActiveAsync()
    expect(view.state.doc.toString()).toBe('# Title\n')
  })

  it('does not resolve variables in a file selected while Faker loads', async () => {
    editor('<a><<$timestamp>></a>', 'xml')
    resolveVarsActive()
    editor('<b><<$timestamp>></b>', 'xml')
    await vi.dynamicImportSettled()
    expect(uiStore.state.varsPreview).toBeNull()
  })

  it('does not overwrite edits made after the variables preview', async () => {
    const text = '<a><<$timestamp>></a>'
    const { view } = editor(text, 'xml')
    resolveVarsActive()
    await vi.dynamicImportSettled()
    const preview = uiStore.state.varsPreview
    expect(preview).not.toBeNull()
    view.dispatch({
      changes: { from: 0, to: text.length, insert: '<a>new</a>' },
    })
    commitVarsPreview(preview!)
    expect(view.state.doc.toString()).toBe('<a>new</a>')
    expect(noticeStore.state?.message).toContain('The file changed')
  })

  it('applies the preview when the original document is unchanged', async () => {
    const { view } = editor('<a><<$timestamp>></a>', 'xml')
    resolveVarsActive()
    await vi.dynamicImportSettled()
    const preview = uiStore.state.varsPreview
    expect(preview).not.toBeNull()
    commitVarsPreview(preview!)
    expect(view.state.doc.toString()).toBe(preview!.text)
  })
})
