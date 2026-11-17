import { findInFiles } from './file-search'
import type { SearchFile } from './file-search'

type Request =
  { files: Array<SearchFile> } | { query: string; matchCase: boolean }

let files: Array<SearchFile> = []
self.onmessage = ({ data }: MessageEvent<Request>) => {
  if ('files' in data) files = data.files
  else
    self.postMessage({
      ...data,
      results: findInFiles(files, data.query, data.matchCase),
    })
}
