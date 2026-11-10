import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { MarkdownPreview } from './MarkdownPreview'
import { profileFor } from '#/components/app/files'
import { rootsStore } from '#/lib/store/disk'
import type { DiskRoot } from '#/lib/store/disk'
import {
  createDiskFile,
  createFile,
  fileAt,
  filesCollection,
} from '#/lib/store/files'
import type { FileLocation } from '#/lib/store/files'
import { workspaceReady } from '#/lib/store/workspace'
import { fakeFolder } from '#/test/fake-fs'

beforeAll(async () => {
  await workspaceReady()
  // jsdom has no object URLs.
  URL.createObjectURL = vi.fn(() => 'blob:diagram')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  rootsStore.setState(() => [])
  for (const file of [...filesCollection.values()]) {
    filesCollection.delete(file.id)
  }
})

function vault() {
  const folder = fakeFolder('Notes', {
    '.obsidian': { 'app.json': '{}' },
    'Home.md': '# Home',
    Projects: {
      'Plan.md': '',
      'Ideas.md': '# Ideas',
      'Loop.md': 'Loop text ![[Loop]]\n\n![[Plan]]',
      'Part.md': '# Part\nFirst [[Ideas]]\n## Two\nSecond',
    },
    assets: { 'diagram.png': 'png' },
  })
  const root: DiskRoot = {
    id: 'vault',
    name: 'Notes',
    handle: folder.handle,
    access: 'granted',
  }
  rootsStore.setState(() => [root])
  return root
}

function preview(content: string, location?: FileLocation) {
  const profile = profileFor('note.md', content)
  const file = location
    ? createDiskFile(location, content, profile)
    : createFile('note.md', content, profile)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MarkdownPreview fileId={file.id} />
    </QueryClientProvider>,
  )
}

describe('links in a note of a vault', () => {
  it('opens the note a [[link]] names in a tab', async () => {
    const root = vault()
    preview('See [[Ideas|my ideas]].', {
      rootId: root.id,
      path: 'Projects/Plan.md',
    })
    const link = await screen.findByRole('link', { name: 'my ideas' })
    expect(link).toHaveAttribute('title', 'Projects/Ideas.md')
    fireEvent.click(link)
    await waitFor(() =>
      expect(fileAt(root.id, 'Projects/Ideas.md')?.content).toBe('# Ideas'),
    )
  })

  it('opens relative Markdown links, and fades links to nothing', async () => {
    const root = vault()
    preview('[Home](../Home.md) and [[Missing]]', {
      rootId: root.id,
      path: 'Projects/Plan.md',
    })
    expect(await screen.findByRole('link', { name: 'Home' })).toHaveAttribute(
      'title',
      'Home.md',
    )
    expect(screen.getByText('Missing')).toHaveAttribute(
      'title',
      'Missing isn’t in this folder',
    )
  })

  it('shows embedded images from the vault at their size', async () => {
    const root = vault()
    preview('![[diagram.png|120]]', { rootId: root.id, path: 'Home.md' })
    const image = await screen.findByRole('img', { name: 'diagram.png' })
    expect(image).toHaveAttribute('src', 'blob:diagram')
    expect(image).toHaveAttribute('width', '120')
    // Alone on its line, so the Center menu can put it in the middle.
    expect(image.closest('[data-image-block]')).not.toBeNull()
  })

  it('shows the note an ![[embed]] names, or the heading it names', async () => {
    const root = vault()
    preview('Before\n\n![[Part#Two]]\n\n![[Part]]', {
      rootId: root.id,
      path: 'Home.md',
    })
    expect(await screen.findByText('First')).toBeInTheDocument()
    expect(screen.getAllByText('Second')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Part > Two' })).toHaveAttribute(
      'title',
      'Projects/Part.md',
    )
    // The embedded note's own links still find their notes.
    expect(screen.getByRole('link', { name: 'Ideas' })).toHaveAttribute(
      'title',
      'Projects/Ideas.md',
    )
  })

  it('links to a note instead of embedding it inside itself', async () => {
    const root = vault()
    preview('![[Loop]]', { rootId: root.id, path: 'Projects/Plan.md' })
    expect(await screen.findByText(/Loop text/)).toBeInTheDocument()
    expect(screen.getAllByText(/Loop text/)).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: 'Loop' })).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Plan' })).toBeInTheDocument()
  })

  it('shows callouts and highlights', async () => {
    const root = vault()
    preview('> [!tip]- Remember\n> Water ==the plants==', {
      rootId: root.id,
      path: 'Home.md',
    })
    expect(await screen.findByText('Remember')).toBeInTheDocument()
    expect(screen.getByText('the plants').tagName).toBe('MARK')
  })
})

describe('links in a note of the browser', () => {
  it('marks a paragraph of images alone as an image block', async () => {
    preview('![a](a.png) ![b](b.png)\n\nText ![c](c.png)')
    const [a, b, c] = await screen.findAllByRole('img')
    expect(a.closest('[data-image-block]')).not.toBeNull()
    expect(b.closest('[data-image-block]')).toBe(
      a.closest('[data-image-block]'),
    )
    expect(c.closest('[data-image-block]')).toBeNull()
  })

  it('shows [[links]] as text, with nowhere to go', async () => {
    preview('See [[Ideas]].')
    const text = await screen.findByText('Ideas')
    expect(text.tagName).toBe('SPAN')
    expect(text).not.toHaveAttribute('title')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
