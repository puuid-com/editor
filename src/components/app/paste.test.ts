import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { askPasteChoice } from './paste'
import { setPasteChoice, uiStore } from './ui-store'
import { createFile, filesCollection } from '#/lib/store/files'
import { workspaceReady } from '#/lib/store/workspace'

beforeAll(() => workspaceReady())

afterEach(() => setPasteChoice(null))

/** Pastes `text` over all of a new file called `name`. */
function paste(name: string, text: string) {
  const file = createFile(name, text)
  askPasteChoice(file.id, text)
  return file.id
}

const offer = () => uiStore.state.pasteChoice

describe('askPasteChoice', () => {
  it('stays quiet when the paste is the type the file already has', () => {
    paste('same.xml', '<order/>')
    expect(offer()).toBeNull()
  })

  it('offers the type the paste reads as when it differs', () => {
    paste('orders.xml', '{"order": 1}')
    expect(offer()).toMatchObject({
      current: 'xml',
      detected: 'json',
      language: 'json',
    })
  })

  it('asks when nothing gives the type away', () => {
    paste('unknown.json', 'hello there')
    expect(offer()).toMatchObject({
      current: 'json',
      detected: null,
      language: 'json',
    })
  })

  it('lets notes and plain text take any text', () => {
    paste('note.md', 'hello there')
    paste('log.txt', 'hello there')
    expect(offer()).toBeNull()
  })

  it('names an untitled file after the type it was given', async () => {
    const id = paste('Untitled', '{"a": 1}')
    expect(offer()).toBeNull()
    await expect.poll(() => filesCollection.get(id)?.name).toBe('Untitled.json')
  })

  it('clears an earlier offer when a later paste needs none', () => {
    paste('first.xml', '{"a": 1}')
    paste('second.xml', '<b/>')
    expect(offer()).toBeNull()
  })
})
