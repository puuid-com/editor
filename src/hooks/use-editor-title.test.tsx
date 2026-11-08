import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  HeadContent,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useEditorTitle } from './use-editor-title'
import { m } from '#/paraglide/messages'

describe('editor browser title', () => {
  it('follows renames, closing files and returning from another route', async () => {
    let filename: string | undefined = 'invoice.xml'
    function Editor() {
      useEditorTitle(filename)
      return null
    }
    const root = createRootRoute({
      component: () => (
        <>
          <HeadContent />
          <Outlet />
        </>
      ),
    })
    const index = createRoute({
      getParentRoute: () => root,
      path: '/',
      head: () => ({
        meta: [
          { title: `${filename || m.seo_title()} | Editor` },
          { property: 'og:title', content: 'Public title' },
        ],
      }),
      component: Editor,
    })
    const about = createRoute({
      getParentRoute: () => root,
      path: '/about',
      head: () => ({ meta: [{ title: 'About | Editor' }] }),
      component: () => null,
    })
    const router = createRouter({
      routeTree: root.addChildren([index, about]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
    render(<RouterProvider router={router} />)
    await waitFor(() => expect(document.title).toBe('invoice.xml | Editor'))
    filename = 'renamed.sql'
    await act(() => router.invalidate())
    await waitFor(() => expect(document.title).toBe('renamed.sql | Editor'))
    await act(() => router.navigate({ to: '/about' }))
    await waitFor(() => expect(document.title).toBe('About | Editor'))
    await act(() => router.navigate({ to: '/' }))
    await waitFor(() => expect(document.title).toBe('renamed.sql | Editor'))
    expect(
      document
        .querySelector('meta[property="og:title"]')
        ?.getAttribute('content'),
    ).toBe('Public title')
    filename = undefined
    await act(() => router.invalidate())
    await waitFor(() =>
      expect(document.title).toBe(`${m.seo_title()} | Editor`),
    )
  })
})
