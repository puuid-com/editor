import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DiskWorkspace } from './DiskWorkspace'
import { TooltipProvider } from '#/components/ui/tooltip'
import type { DiskRoot } from '#/lib/store/disk'
import { fakeFolder } from '#/test/fake-fs'

function show(
  tree: Parameters<typeof fakeFolder>[1],
  search = '',
  tabs: ReadonlyMap<string, string> = new Map(),
  activeId: string | null = null,
) {
  const root: DiskRoot = {
    id: 'root',
    name: 'Notes',
    handle: fakeFolder('Notes', tree).handle,
    access: 'granted',
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <DiskWorkspace
          root={root}
          tabs={tabs}
          activeId={activeId}
          search={search}
          askName={() => undefined}
          onOpened={() => undefined}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

const notes = {
  '.obsidian': {
    'app.json': JSON.stringify({
      attachmentFolderPath: 'assets',
      userIgnoreFilters: ['Archive/'],
    }),
  },
  '.trash': { 'old.md': '' },
  assets: { 'diagram.png': '', 'stray.md': '' },
  Archive: { 'Old plan.md': '' },
  'Plan.md': '',
}

describe('an Obsidian vault in the explorer', () => {
  it('says it is a vault and hides its settings and attachments', async () => {
    show(notes)
    expect(
      await screen.findByText(', Obsidian vault on this device'),
    ).toBeInTheDocument()
    expect(await screen.findByText('Plan.md')).toBeInTheDocument()
    expect(screen.getByText('Archive')).toBeInTheDocument()
    for (const hidden of ['.obsidian', '.trash', 'assets'])
      expect(screen.queryByText(hidden)).not.toBeInTheDocument()
  })

  it('leaves excluded files out of search, but not attachments', async () => {
    show(notes, 'plan')
    expect(await screen.findByText('Plan.md')).toBeInTheDocument()
    expect(screen.queryByText('Old plan.md')).not.toBeInTheDocument()
    show(notes, 'stray')
    expect(await screen.findByText('stray.md')).toBeInTheDocument()
  })

  it('shows any other folder as a folder', async () => {
    show({ assets: { 'a.xml': '' } })
    expect(
      await screen.findByText(', Folder on this device'),
    ).toBeInTheDocument()
    expect(await screen.findByText('assets')).toBeInTheDocument()
  })
})

describe('the active tab in the explorer', () => {
  it('opens the folders down to its file', async () => {
    show(
      { invoices: { '2026': { 'order.xml': '' } }, 'rates.json': '' },
      '',
      new Map([['invoices/2026/order.xml', 'tab']]),
      'tab',
    )
    const row = await screen.findByText('order.xml')
    expect(row.closest('button')).toHaveAttribute('aria-current', 'page')
  })
})
