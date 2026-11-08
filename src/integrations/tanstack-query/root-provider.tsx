import { QueryClient } from '@tanstack/react-query'

import { singleton } from '#/lib/store/singleton'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, data fetched on the server would otherwise be refetched
        // immediately on the client.
        staleTime: 60 * 1000,
      },
    },
  })
}

/**
 * The query client: a new one for each server request, and one for the
 * page in the browser, which code outside React reaches through
 * `browserQueryClient`.
 */
export function getContext() {
  return {
    queryClient:
      typeof window === 'undefined' ? makeQueryClient() : browserQueryClient(),
  }
}

export function browserQueryClient() {
  return singleton('queryClient', makeQueryClient)
}
