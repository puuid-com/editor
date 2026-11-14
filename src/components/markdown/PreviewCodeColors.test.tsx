import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { MarkdownPreview } from './MarkdownPreview'
import { markdownSupport } from './md-language'
import { profileFor } from '#/components/app/files'
import { registerFileView } from '#/components/editor/editor-store'
import { fileIdField } from '#/components/editor/file-id'
import { createFile, filesCollection } from '#/lib/store/files'
import { workspaceReady } from '#/lib/store/workspace'

const views: Array<EditorView> = []

beforeAll(async () => {
  await workspaceReady()
})

afterEach(() => {
  views.splice(0).forEach((view) => view.destroy())
  for (const file of [...filesCollection.values()]) {
    filesCollection.delete(file.id)
  }
})

/** A note's preview, beside an editor on the same text. */
async function preview(content: string) {
  const file = createFile('note.md', content, profileFor('note.md', content))
  const view = new EditorView({
    state: EditorState.create({
      doc: content,
      extensions: [fileIdField.init(() => file.id), markdownSupport()],
    }),
  })
  views.push(view)
  registerFileView(file.id, view)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MarkdownPreview fileId={file.id} />
    </QueryClientProvider>,
  )
  const region = await screen.findByRole('region')
  await within(region).findAllByText(/./, { selector: 'code' })
  return { view, codes: () => region.querySelectorAll('code') }
}

describe('colouring code from the preview', () => {
  it('colours the clicked code in the source', async () => {
    const { view, codes } = await preview('Run `x`, then `x` again.')
    fireEvent.click(codes()[1])
    const palette = await screen.findByRole('toolbar', { name: 'Code colour' })
    fireEvent.click(within(palette).getByRole('radio', { name: 'Red' }))
    expect(view.state.doc.toString()).toBe(
      'Run `x`, then <code style="color: red">x</code> again.',
    )
  })

  it('shows the colour HTML code has, and makes it plain again', async () => {
    const { view, codes } = await preview(
      'A <code style="color: teal">t</code>',
    )
    expect(codes()[0]).toHaveClass('md-code-color')
    fireEvent.click(codes()[0])
    const palette = await screen.findByRole('toolbar', { name: 'Code colour' })
    expect(within(palette).getByRole('radio', { name: 'Teal' })).toBeChecked()
    fireEvent.click(
      within(palette).getByRole('button', { name: 'Remove colour' }),
    )
    expect(view.state.doc.toString()).toBe('A `t`')
  })

  it('leaves code in a link to the link', async () => {
    const { codes } = await preview('[`x`](https://example.com)')
    fireEvent.click(codes()[0])
    expect(screen.queryByRole('toolbar')).toBeNull()
  })
})
