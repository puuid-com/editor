import { useEffect, useRef, useState } from 'react'

import SearchWorker from './file-search.worker?worker'
import type { SearchReply, SearchSources } from './file-search'

/** Searches `sources` in a worker, which keeps the text between keystrokes. */
export function useFileSearch(
  sources: SearchSources,
  query: string,
  matchCase: boolean,
) {
  const worker = useRef<Worker | null>(null)
  const [reply, setReply] = useState<
    (SearchReply & { sources: SearchSources }) | null
  >(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    // Send the text once per snapshot. Keystrokes send only the search terms.
    let search: Worker
    try {
      search = new SearchWorker()
    } catch {
      setFailed(true)
      return
    }
    worker.current = search
    search.onmessage = ({ data }: MessageEvent<SearchReply>) => {
      setFailed(false)
      setReply({ ...data, sources })
    }
    search.onerror = () => setFailed(true)
    search.postMessage(sources)
    return () => {
      search.terminate()
      worker.current = null
    }
  }, [sources])
  useEffect(() => {
    worker.current?.postMessage({ query, matchCase })
  }, [sources, query, matchCase])
  return {
    failed,
    reply:
      reply?.sources === sources &&
      reply.query === query &&
      reply.matchCase === matchCase
        ? reply
        : null,
  }
}
