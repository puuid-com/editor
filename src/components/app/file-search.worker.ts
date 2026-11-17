import { searchWorkspace } from './file-search'
import type { SearchReply, SearchSources } from './file-search'

let sources: SearchSources = { files: [], disk: [] }
let generation = 0

self.onmessage = ({
  data,
}: MessageEvent<SearchSources | Pick<SearchReply, 'query' | 'matchCase'>>) => {
  const current = ++generation
  if ('files' in data) sources = data
  else
    void searchWorkspace(
      sources,
      data,
      (reply) => self.postMessage(reply),
      () => current !== generation,
    )
}
