import { beforeAll, describe, expect, it } from 'vitest'

import { fileProfileIds } from './file-profiles'
import {
  createFile,
  forgetFile,
  saveContent,
  setFileProfile,
  settleContentSave,
} from './files'
import { DEFAULT_PROFILE_ID } from './persist'
import { workspaceReady } from './workspace'

beforeAll(() => workspaceReady())

describe('the profile of each file', () => {
  it('follows new files, profile switches and closed tabs', async () => {
    const before = createFile('before.xml')
    const profiles = fileProfileIds()
    expect(profiles.state.get(before.id)).toBe(DEFAULT_PROFILE_ID)

    const file = createFile('a.xml', '<a/>', 'other')
    expect(profiles.state.get(file.id)).toBe('other')

    await setFileProfile(file.id, DEFAULT_PROFILE_ID)
    expect(profiles.state.get(file.id)).toBe(DEFAULT_PROFILE_ID)

    await forgetFile(file.id)
    expect(profiles.state.has(file.id)).toBe(false)
  })

  it('is left alone by edits to the text', async () => {
    const profiles = fileProfileIds()
    const file = createFile('b.xml', '<b/>')
    const before = profiles.state
    saveContent({ id: file.id, content: '<b>1</b>' })
    await settleContentSave()
    expect(profiles.state).toBe(before)
  })
})
