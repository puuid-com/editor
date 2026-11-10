import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { DeleteDialog } from './DeleteDialog'
import { askDelete, uiStore } from './ui-store'
import { createFile, filesCollection } from '#/lib/store/files'
import { settleWrites } from '#/lib/store/persist'
import { sessionStore, setActive } from '#/lib/store/session'
import { workspaceReady } from '#/lib/store/workspace'

beforeAll(() => workspaceReady())

afterEach(() => settleWrites())

describe('delete dialog', () => {
  afterEach(() => {
    askDelete(null)
    setActive(null)
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
