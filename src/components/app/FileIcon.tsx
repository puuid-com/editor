import {
  IconFileCode,
  IconFileDots,
  IconJson,
  IconSql,
  IconBarcode,
  IconMarkdown,
  IconTxt,
} from '@tabler/icons-react'

import { languageOf } from '#/lib/document'
import type { TabFile } from './files'

/** The icon of a file's type; an empty file has none yet. */
export function FileIcon({ file }: { file: Pick<TabFile, 'name' | 'empty'> }) {
  if (file.empty) return <IconFileDots />
  const language = languageOf(file.name, '')
  if (language === 'json') return <IconJson />
  if (language === 'zpl') return <IconBarcode />
  if (language === 'sql') return <IconSql />
  if (language === 'md') return <IconMarkdown />
  if (language === 'txt') return <IconTxt />
  return <IconFileCode />
}
