import { act, fireEvent, render, screen } from '@testing-library/react'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { CompareView } from './CompareView'
import {
  openCompare,
  setCompareIgnoreFormatting,
  setCompareIgnoreWhitespace,
  uiStore,
} from '#/components/app/ui-store'
import { editorPrefs, setDiffLayout } from '#/components/editor/word-wrap'
import { TooltipProvider } from '#/components/ui/tooltip'
import { createFile, filesCollection } from '#/lib/store/files'

function clearFiles() {
  for (const file of [...filesCollection.values()]) {
    filesCollection.delete(file.id)
  }
}

function open(a: string, b: string, wide = true) {
  const original = createFile('before.xml', a)
  const changed = createFile('after.xml', b)
  openCompare(changed.id, original.id)
  render(
    <TooltipProvider>
      <CompareView fileId={changed.id} otherId={original.id} wide={wide} />
    </TooltipProvider>,
  )
  return { original, changed }
}

const ZERO_WIDTH = String.fromCharCode(0x200b)

/** The text of each diff row on screen, line numbers and signs included. */
function rows() {
  const region = screen.getByRole('region', { name: 'Compared lines' })
  return [...region.querySelectorAll('[data-index]')].map((row) =>
    row.textContent.replaceAll(ZERO_WIDTH, ''),
  )
}

// jsdom lays nothing out; the list needs a height to show rows in.
const sizes = ['clientHeight', 'clientWidth'] as const
beforeAll(() => {
  for (const size of sizes)
    Object.defineProperty(HTMLElement.prototype, size, {
      configurable: true,
      get: () => 600,
    })
})
afterAll(() => {
  for (const size of sizes)
    delete (HTMLElement.prototype as Partial<HTMLElement>)[size]
})

const layout = editorPrefs.state.diffLayout
beforeEach(clearFiles)

afterEach(() => {
  uiStore.setState((s) => ({ ...s, compare: null, compareSwapped: false }))
  setCompareIgnoreFormatting(false)
  setCompareIgnoreWhitespace(false)
  setDiffLayout(layout)
  clearFiles()
})

describe('CompareView', () => {
  it('shows a hunk with both line numbers, signs and context', async () => {
    setDiffLayout('unified')
    open(
      '<r>\n  <a>1</a>\n  <b>2</b>\n</r>',
      '<r>\n  <a>1</a>\n  <b>3</b>\n</r>',
    )
    expect(
      await screen.findByText('Lines added: 1, removed: 1, in 1 changes'),
    ).toBeInTheDocument()
    expect(rows()).toEqual([
      '@@ -1,4 +1,4 @@',
      '11 <r>',
      '22   <a>1</a>',
      '3-  <b>2</b>',
      '3+  <b>3</b>',
      '44 </r>',
    ])
  })

  it('pairs the sides in the split layout', async () => {
    setDiffLayout('split')
    open('<r>\n  <b>2</b>\n</r>', '<r>\n  <b>3</b>\n</r>')
    await screen.findByText('Lines added: 1, removed: 1, in 1 changes')
    expect(rows()[2]).toBe('2-  <b>2</b>2+  <b>3</b>')
  })

  it('switches between split and unified', async () => {
    setDiffLayout('split')
    open('<r/>', '<s/>')
    await screen.findByText('Lines added: 1, removed: 1, in 1 changes')
    fireEvent.click(screen.getByRole('radio', { name: 'Unified' }))
    expect(editorPrefs.state.diffLayout).toBe('unified')
    expect(rows()).toEqual(['@@ -1,1 +1,1 @@', '1-<r/>', '1+<s/>'])
  })

  it('stays unified, with no layout switch, on a phone', async () => {
    setDiffLayout('split')
    open('<r/>', '<s/>', false)
    await screen.findByText('Lines added: 1, removed: 1, in 1 changes')
    expect(screen.queryByRole('radio', { name: 'Split' })).toBeNull()
    expect(rows()).toHaveLength(3)
  })

  it('marks the changed words', async () => {
    setDiffLayout('unified')
    open('<status>pending</status>', '<status>shipped</status>')
    await screen.findByText('Lines added: 1, removed: 1, in 1 changes')
    expect(screen.getByText('pending')).toHaveClass('bg-(--destructive)/28')
    expect(screen.getByText('shipped')).toHaveClass('bg-(--hl-green)/35')
  })

  it('opens folded lines', async () => {
    setDiffLayout('unified')
    const lines = Array.from({ length: 12 }, (_, i) => `<l${i}/>`)
    open(lines.join('\n'), [...lines.slice(0, 11), '<changed/>'].join('\n'))
    await screen.findByText('Unchanged lines: 8')
    fireEvent.click(
      screen.getByRole('button', { name: 'Show all 8 hidden lines' }),
    )
    expect(screen.queryByText('Unchanged lines: 8')).toBeNull()
    expect(rows()).toHaveLength(14)
  })

  it('shows formatting differences unless told to ignore them', async () => {
    open('<r><a>1</a></r>', '<r>\n  <a>1</a>\n</r>\n')
    expect(
      await screen.findByText('Lines added: 3, removed: 1, in 1 changes'),
    ).toBeInTheDocument()
    act(() => setCompareIgnoreFormatting(true))
    expect(
      await screen.findByText(
        'Both files have the same lines, with what you chose to hide left out.',
      ),
    ).toBeInTheDocument()
  })

  it('can hide whitespace changes', async () => {
    open('<r>\n  <a/>\n</r>', '<r>\n\t<a/>\n</r>')
    await screen.findByText('Lines added: 1, removed: 1, in 1 changes')
    act(() => setCompareIgnoreWhitespace(true))
    expect(
      await screen.findByText(
        'Both files have the same lines, with what you chose to hide left out.',
      ),
    ).toBeInTheDocument()
  })

  it('says when a side cannot be formatted', async () => {
    setCompareIgnoreFormatting(true)
    open('<r><a>1</a></r>', '<r><a>1</r>')
    expect(
      await screen.findByText('Shown as written: after.xml has errors'),
    ).toBeInTheDocument()
  })

  it('swaps which side is the original', async () => {
    setDiffLayout('unified')
    open('<a/>', '<a/>\n<b/>')
    await screen.findByText('Lines added: 1, removed: 0, in 1 changes')
    fireEvent.click(screen.getByRole('button', { name: 'Swap sides' }))
    expect(
      await screen.findByText('Lines added: 0, removed: 1, in 1 changes'),
    ).toBeInTheDocument()
  })

  it('follows edits to either file', async () => {
    const { changed } = open('<r/>', '<r/>')
    expect(
      await screen.findByText('Both files have the same lines.'),
    ).toBeInTheDocument()
    act(() => {
      filesCollection.update(changed.id, (draft) => {
        draft.content = '<r>\n  <a/>\n</r>'
      })
    })
    expect(
      await screen.findByText('Lines added: 3, removed: 1, in 1 changes'),
    ).toBeInTheDocument()
  })

  it('closes with Escape or the close button', () => {
    const { original, changed } = open('<r/>', '<r/>')
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' })
    expect(uiStore.state.compare).toBeNull()

    openCompare(changed.id, original.id)
    fireEvent.click(screen.getByRole('button', { name: 'Close comparison' }))
    expect(uiStore.state.compare).toBeNull()
  })
})
