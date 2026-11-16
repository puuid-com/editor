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
import { useSyncExternalStore } from 'react'
import { describe, expect, it } from 'vitest'
import { useEditorTitle } from './use-editor-title'

/** The open file's name, as the editor's store would hold it. */
function nameStore(initial: string | undefined) {
  let name = initial
  const listeners = new Set<() => void>()
  return {
    set(next: string | undefined) {
      name = next
      listeners.forEach((listener) => listener())
    },
    use: () =>
      useSyncExternalStore(
        (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        () => name,
      ),
  }
}

describe('editor browser title', () => {
  it('follows renames, closing files and returning from another route', async () => {
    const file = nameStore('invoice.xml')
    let routeTitle = 'XML editor | Editor'
    function Editor() {
      useEditorTitle(file.use())
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
          { title: routeTitle },
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

    // A rename shows without the route loading again.
    act(() => file.set('renamed.sql'))
    expect(document.title).toBe('renamed.sql | Editor')

    // Another page has its own title, and the name is back on return.
    await act(() => router.navigate({ to: '/about' }))
    await waitFor(() => expect(document.title).toBe('About | Editor'))
    await act(() => router.navigate({ to: '/' }))
    await waitFor(() => expect(document.title).toBe('renamed.sql | Editor'))

    // The route renders a new title of its own, as in another language:
    // the name stays over it.
    routeTitle = 'Éditeur XML | Editor'
    await act(() => router.invalidate())
    await waitFor(() => expect(document.title).toBe('renamed.sql | Editor'))
    expect(document.querySelectorAll('title')).toHaveLength(1)

    // With no file open, the route's own title shows, as it is now.
    act(() => file.set(undefined))
    await waitFor(() => expect(document.title).toBe('Éditeur XML | Editor'))

    // And the router still owns it: its next title lands.
    await act(() => router.navigate({ to: '/about' }))
    await waitFor(() => expect(document.title).toBe('About | Editor'))
    expect(
      document
        .querySelector('meta[property="og:title"]')
        ?.getAttribute('content'),
    ).not.toBe('renamed.sql | Editor')
  })
})
