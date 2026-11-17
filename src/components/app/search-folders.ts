import { queryOptions } from '@tanstack/react-query'

import { diskKeys, vaultQuery } from './disk-queries'
import type { DiskSearchFile } from './file-search'
import { listFiles } from '#/lib/disk-tree'
import { imageMime } from '#/lib/image-file'
import { isExcluded } from '#/lib/obsidian'
import type { Vault } from '#/lib/obsidian'
import type { DiskRoot } from '#/lib/store/disk'
import type { FileLocation } from '#/lib/store/files'

export interface FolderContents {
  rootId: string
  vault: Vault | null
  files: Array<DiskSearchFile>
  skipped: boolean
}

export const diskSearchId = ({ rootId, path }: FileLocation) =>
  `${rootId}/${path}`

/** Discover handles once per folder. The search worker reads text only as needed. */
export const searchFolderQuery = (root: DiskRoot) =>
  queryOptions({
    queryKey: [...diskKeys.root(root.id), 'content-search'],
    staleTime: 0,
    networkMode: 'always',
    queryFn: async ({ signal, client }): Promise<FolderContents> => {
      let skipped = false
      const [entries, vault] = await Promise.all([
        listFiles(root.handle, {
          limit: Infinity,
          signal,
          onUnreadable: () => {
            skipped = true
          },
        }),
        client.fetchQuery(vaultQuery(root)),
      ])
      const files: Array<DiskSearchFile> = []
      for (const entry of entries) {
        if (imageMime(entry.name) || isExcluded(vault, entry.path)) continue
        const location = { rootId: root.id, path: entry.path }
        files.push({
          id: diskSearchId(location),
          name: `${root.name}/${entry.path}`,
          location,
          handle: entry.handle as FileSystemFileHandle,
        })
      }
      return { rootId: root.id, vault, files, skipped }
    },
  })
