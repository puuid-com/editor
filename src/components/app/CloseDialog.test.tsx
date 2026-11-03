import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { CloseDialog } from './CloseDialog'
import { askClose, uiStore } from './ui-store'
import { createFile, filesCollection } from '#/lib/store/files'
import { settleWrites } from '#/lib/store/persist'
import { sessionStore, setActive } from '#/lib/store/session'
import { workspaceReady } from '#/lib/store/workspace'

beforeAll(() => workspaceReady())

afterEach(() => settleWrites())

describe('close dialog', () => {
  afterEach(() => {
    askClose(null)
    setActive(null)
  })

  it('closes several tabs and moves to the nearest one left open', async () => {
    const [a, b, c] = ['a.xml', 'b.xml', 'c.xml'].map((name) =>
      createFile(name),
    )
    setActive(a.id)
    askClose([a.id, b.id])
    render(<CloseDialog openIds={[a.id, b.id, c.id]} />)

    expect(screen.getByText('Close 2 tabs?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close and delete' }))

    await waitFor(() => expect(uiStore.state.closeIds).toBeNull())
    expect(sessionStore.state.activeId).toBe(c.id)
    expect(filesCollection.get(a.id)?.deletedAt).not.toBeNull()
    expect(filesCollection.get(b.id)?.deletedAt).not.toBeNull()
    expect(filesCollection.get(c.id)?.deletedAt).toBeNull()
  })
})
