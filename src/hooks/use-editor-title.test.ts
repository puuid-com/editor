import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useEditorTitle } from './use-editor-title'
import { m } from '#/paraglide/messages'

describe('editor browser title', () => {
  it('follows file switches, renames and closing the last file', () => {
    document.title = 'Initial'
    const initialProps: { name?: string } = { name: 'invoice.xml' }
    const { rerender, unmount } = renderHook(
      ({ name }: { name?: string }) => useEditorTitle(name),
      { initialProps },
    )
    expect(document.title).toBe('invoice.xml | Editor')
    rerender({ name: 'query.sql' })
    expect(document.title).toBe('query.sql | Editor')
    rerender({ name: 'renamed.sql' })
    expect(document.title).toBe('renamed.sql | Editor')
    rerender({})
    expect(document.title).toBe(`${m.seo_title()} | Editor`)
    unmount()
    expect(document.title).toBe('Initial')
  })

  it('does not overwrite the next route title on unmount', () => {
    const { unmount } = renderHook(() => useEditorTitle('notes.md'))
    document.title = 'About | Editor'
    unmount()
    expect(document.title).toBe('About | Editor')
  })
})
