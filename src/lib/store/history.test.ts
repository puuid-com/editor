import { Store } from '@tanstack/store'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createFile, filesCollection, renameFile, saveContent } from './files'
import { findHighlight, highlightsCollection, setHighlight } from './highlights'
import {
  flushHistory,
  historyDepths,
  recordStep,
  recordTextEdit,
  redoStep,
  resetHistory,
  undoStep,
  watchStore,
  withoutHistory,
} from './history'
import { findPin, pinTag, pinsCollection } from './pins'
import { deleteProfile } from './profile-actions'
import { createProfile, profilesCollection, updateProfile } from './profiles'
import { workspaceReady } from './workspace'

beforeAll(() => workspaceReady())

beforeEach(() => {
  withoutHistory(() => {
    for (const c of [pinsCollection, highlightsCollection, filesCollection])
      for (const row of [...c.values()]) c.delete(row.id)
  })
  resetHistory()
})

function text(fileId: string | null, log: Array<string> = []) {
  return {
    fileId,
    undo: () => (log.push(`undo ${fileId}`), true),
    redo: () => (log.push(`redo ${fileId}`), true),
  }
}

describe('history', () => {
  it('undoes and redoes a pin', () => {
    pinTag('Body')
    flushHistory()
    expect(findPin('Body')).toBeDefined()
    undoStep(null)
    expect(findPin('Body')).toBeUndefined()
    redoStep(null)
    expect(findPin('Body')).toBeDefined()
  })

  it('takes back a recolour without losing the rule', () => {
    setHighlight('Body', 'red')
    flushHistory()
    setHighlight('Body', 'blue')
    flushHistory()
    undoStep(null)
    expect(findHighlight('Body')?.color).toBe('red')
    undoStep(null)
    expect(findHighlight('Body')).toBeUndefined()
  })

  it('keeps text and other changes in the order they were made', () => {
    const log: Array<string> = []
    recordTextEdit('a', 1)
    pinTag('Body')
    flushHistory()
    recordTextEdit('a', 1)
    undoStep(text('a', log))
    expect(log).toEqual(['undo a'])
    expect(findPin('Body')).toBeDefined()
    undoStep(text('a', log))
    expect(findPin('Body')).toBeUndefined()
    undoStep(text('a', log))
    expect(log).toEqual(['undo a', 'undo a'])
  })

  it("skips another file's text until it is open", () => {
    const log: Array<string> = []
    pinTag('Body')
    flushHistory()
    recordTextEdit('b', 1)
    undoStep(text('a', log))
    expect(log).toEqual([])
    expect(findPin('Body')).toBeUndefined()
    expect(historyDepths('b').undo).toBe(1)
  })

  it('drops the redo steps once something new happens', () => {
    pinTag('Body')
    flushHistory()
    undoStep(null)
    pinTag('Header')
    flushHistory()
    expect(historyDepths(null).redo).toBe(0)
    expect(redoStep(null)).toBe(false)
  })

  it('leaves text saves to the editor and undoes renames', async () => {
    const file = withoutHistory(() => createFile('a.xml', '<a/>'))
    saveContent({ id: file.id, content: '<b/>' })
    flushHistory()
    expect(historyDepths(null).undo).toBe(0)
    renameFile(file.id, 'b.xml')
    flushHistory()
    undoStep(null)
    expect(filesCollection.get(file.id)?.name).toBe('a.xml')
    expect(filesCollection.get(file.id)?.content).toBe('<b/>')
  })

  it('makes an action that waits on its writes one step', async () => {
    const profile = await createProfile({ name: 'Temp' })
    updateProfile(profile.id, { color: 'red' })
    await pinsCollection.insert({
      id: 'pin',
      tag: 'Body',
      createdAt: 0,
      profileId: profile.id,
    }).isPersisted.promise
    flushHistory()
    await deleteProfile(profile.id)
    // The deletes wait on one another; the step ends after the last.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(historyDepths(null).undo).toBe(2)
    undoStep(null)
    expect(profilesCollection.get(profile.id)?.color).toBe('red')
    expect(pinsCollection.get('pin')?.profileId).toBe(profile.id)
    undoStep(null)
    expect(profilesCollection.has(profile.id)).toBe(false)
    expect(pinsCollection.has('pin')).toBe(false)
  })

  it('undoes watched stores and custom steps', () => {
    const store = watchStore(new Store({ wrap: false }))
    let theme = 'light'
    store.setState((s) => ({ ...s, wrap: true }))
    theme = 'dark'
    recordStep({
      undo: () => (theme = 'light'),
      redo: () => (theme = 'dark'),
    })
    flushHistory()
    undoStep(null)
    expect(store.state.wrap).toBe(false)
    expect(theme).toBe('light')
    redoStep(null)
    expect(store.state.wrap).toBe(true)
    expect(theme).toBe('dark')
  })
})
