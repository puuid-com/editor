import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { OpenSharedDialog } from './OpenSharedDialog'
import { encodeShare } from '#/lib/share'
import * as share from '#/lib/share'
import type { SharedFile } from '#/lib/share'
import { noticeStore } from './notice-store'
import { filesCollection } from '#/lib/store/files'
import { DEFAULT_FORMAT } from '#/lib/store/format-settings'
import { profileHighlights } from '#/lib/store/highlights'
import { profilesCollection } from '#/lib/store/profiles'
import { workspaceReady } from '#/lib/store/workspace'

beforeAll(() => workspaceReady())

const profile = {
  id: 'shared-profile',
  name: 'Partner',
  color: 'teal',
  format: DEFAULT_FORMAT,
  highlights: [{ tag: 'price', color: 'red', enabled: true }],
  pins: [],
  defaults: [],
}

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
  for (const file of [...filesCollection.values()]) {
    filesCollection.delete(file.id)
  }
  if (profilesCollection.has(profile.id)) profilesCollection.delete(profile.id)
})

describe('OpenSharedDialog', () => {
  it.each(['resolve', 'reject'] as const)(
    'ignores a stale link that finishes with %s',
    async (outcome) => {
      const first = Promise.withResolvers<SharedFile>()
      const second = Promise.withResolvers<SharedFile>()
      vi.spyOn(share, 'decodeShare').mockImplementation((hash) =>
        hash === '#share=first' ? first.promise : second.promise,
      )
      history.replaceState(null, '', '#share=first')
      render(<OpenSharedDialog />)
      act(() => {
        history.replaceState(null, '', '#share=second')
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      })
      await act(async () => {
        second.resolve({ name: 'new.xml', content: '<new/>' })
        await second.promise
      })
      const notice = noticeStore.state
      await act(async () => {
        if (outcome === 'resolve')
          first.resolve({ name: 'old.xml', content: '<old/>' })
        else first.reject(new Error('Invalid old link'))
        await first.promise.catch(() => undefined)
      })
      expect(screen.getByRole('alertdialog')).toHaveTextContent('new.xml')
      expect(screen.queryByText(/old.xml/)).not.toBeInTheDocument()
      expect(window.location.hash).toBe('#share=second')
      expect(noticeStore.state).toBe(notice)
    },
  )

  it('ignores a link decoded after the dialog unmounts', async () => {
    const pending = Promise.withResolvers<SharedFile>()
    vi.spyOn(share, 'decodeShare').mockReturnValue(pending.promise)
    history.replaceState(null, '', '#share=pending')
    const { unmount } = render(<OpenSharedDialog />)
    unmount()
    const notice = noticeStore.state
    await act(async () => {
      pending.reject(new Error('Invalid old link'))
      await pending.promise.catch(() => undefined)
    })
    expect(window.location.hash).toBe('#share=pending')
    expect(noticeStore.state).toBe(notice)
  })

  it('adds the profile a link carries and opens the file in it', async () => {
    window.location.hash = await encodeShare({
      name: 'order.xml',
      content: '<order/>',
      profile,
    })
    render(<OpenSharedDialog />)
    const add = await screen.findByRole('radio', {
      name: /Add it as a new profile/,
    })
    expect(add).toBeChecked()
    expect(
      screen.getByRole('radio', { name: /Use my current profile/ }),
    ).toBeInTheDocument()
    expect(screen.getByText(/No variable values/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    const file = [...filesCollection.values()].find(
      (f) => f.name === 'order.xml',
    )
    expect(file?.profileId).toBe(profile.id)
    expect(profilesCollection.get(profile.id)?.name).toBe('Partner')
    expect(profileHighlights(profile.id).map((r) => r.tag)).toEqual(['price'])
  })
})
