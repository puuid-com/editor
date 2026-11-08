import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

/** Recompute the route head when the active file is switched, renamed or closed. */
export function useEditorTitle(filename?: string) {
  const router = useRouter()
  useEffect(() => {
    void router.invalidate({ filter: (match) => match.routeId === '/' })
  }, [router, filename])
}
