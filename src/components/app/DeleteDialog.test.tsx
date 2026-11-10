import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { DeleteDialog } from './DeleteDialog'
import * as files from './files'
import { askDelete, uiStore } from './ui-store'
import { createFile, filesCollection } from '#/lib/store/files'
import { settleWrites } from '#/lib/store/persist'
import { sessionStore, setActive } from '#/lib/store/session'
import { workspaceReady } from '#/lib/store/workspace'

beforeAll(() => workspaceReady())

afterEach(() => settleWrites())

describe('delete dialog', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    askDelete(null)
    setActive(null)
  })

  it('keeps a failed deletion open and permits retrying', async () => {
    const file = createFile('retry.xml')
    askDelete([file.id])
    const remove = vi
      .spyOn(files, 'deleteFiles')
      .mockRejectedValueOnce(new Error('Storage failed'))
    render(<DeleteDialog openIds={[file.id]} />)
    const confirm = screen.getByRole('button', { name: 'Delete' })
    fireEvent.click(confirm)
    await waitFor(() => expect(confirm).toBeEnabled())
    expect(uiStore.state.deleteIds).toEqual([file.id])
    expect(filesCollection.get(file.id)?.deletedAt).toBeNull()
    fireEvent.click(confirm)
    await waitFor(() => expect(uiStore.state.deleteIds).toBeNull())
    expect(remove).toHaveBeenCalledTimes(2)
  })

  it('deletes several files and moves to the nearest tab left open', async () => {
    const [a, b, c] = ['a.xml', 'b.xml', 'c.xml'].map((name) =>
      createFile(name),
    )
    setActive(a.id)
    askDelete([a.id, b.id])
    render(<DeleteDialog openIds={[a.id, b.id, c.id]} />)

    expect(screen.getByText('Delete 2 files?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(uiStore.state.deleteIds).toBeNull())
    expect(sessionStore.state.activeId).toBe(c.id)
    expect(filesCollection.get(a.id)?.deletedAt).not.toBeNull()
    expect(filesCollection.get(b.id)?.deletedAt).not.toBeNull()
    expect(filesCollection.get(c.id)?.deletedAt).toBeNull()
  })
})
