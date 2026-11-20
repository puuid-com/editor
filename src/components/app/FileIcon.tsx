import { IconFile, IconFileDots } from '@tabler/icons-react'

import { fileLook } from './file-look'
import { imageMime } from '#/lib/image-file'
import type { TabFile } from './files'

/** The icon of a file's type; an empty file has none yet. */
export function FileIcon({
  file,
}: {
  file: Pick<TabFile, 'name' | 'empty'> & { supported?: boolean }
}) {
  if (file.supported === false) return <IconFile />
  // Images are never empty; any other file without content has no type yet.
  if (file.empty && !imageMime(file.name)) return <IconFileDots />
  const look = fileLook(file.name)
  const Glyph = look.icon
  return (
    <Glyph
      style={look.tone ? { color: `var(--hl-${look.tone})` } : undefined}
    />
  )
}
