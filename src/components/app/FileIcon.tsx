import {
  IconApi,
  IconBarcode,
  IconBraces,
  IconBrandCSharp,
  IconBrandNpm,
  IconBrandTypescript,
  IconDatabase,
  IconDeviceMobile,
  IconFile,
  IconFileCode,
  IconFileDots,
  IconFileText,
  IconGif,
  IconHistory,
  IconInfoCircle,
  IconLayoutDashboard,
  IconLicense,
  IconLock,
  IconLogs,
  IconMapPin,
  IconMarkdown,
  IconNotebook,
  IconPhoto,
  IconRoute,
  IconRss,
  IconSchema,
  IconSettings,
  IconTable,
  IconTransform,
  IconVectorBezier2,
  IconWorldWww,
} from '@tabler/icons-react'
import type { Icon } from '@tabler/icons-react'

import { languageOf } from '#/lib/document'
import { imageMime } from '#/lib/image-file'
import type { DocLanguage } from '#/lib/xml/model'
import type { TabFile } from './files'

type Tone = 'blue' | 'purple' | 'pink' | 'red' | 'amber' | 'green' | 'teal'

/** A file type's look: its glyph and, unless plain, a highlight colour. */
export interface FileLook {
  icon: Icon
  tone?: Tone
}

// Whole names first, as `package.json` is more than any JSON file.
const NAMES: Array<[RegExp, FileLook]> = [
  [/^package\.json$/i, { icon: IconBrandNpm, tone: 'red' }],
  [/^(package-lock|npm-shrinkwrap)\.json$/i, { icon: IconLock, tone: 'red' }],
  [/^[jt]sconfig(\..+)?\.json$/i, { icon: IconBrandTypescript, tone: 'blue' }],
  [/^readme(\.(md|markdown|txt))?$/i, { icon: IconInfoCircle, tone: 'blue' }],
  [
    /^(changelog|history)(\.(md|markdown|txt))?$/i,
    { icon: IconHistory, tone: 'green' },
  ],
  [
    /^(license|licence|copying)(\.(md|markdown|txt))?$/i,
    { icon: IconLicense, tone: 'amber' },
  ],
]

const EXTENSIONS: Record<string, FileLook> = {
  xml: { icon: IconFileCode, tone: 'amber' },
  xsd: { icon: IconSchema, tone: 'purple' },
  xsl: { icon: IconTransform, tone: 'purple' },
  xslt: { icon: IconTransform, tone: 'purple' },
  wsdl: { icon: IconApi, tone: 'teal' },
  svg: { icon: IconVectorBezier2, tone: 'amber' },
  plist: { icon: IconSettings },
  config: { icon: IconSettings },
  csproj: { icon: IconBrandCSharp, tone: 'purple' },
  xaml: { icon: IconLayoutDashboard, tone: 'blue' },
  rss: { icon: IconRss, tone: 'amber' },
  atom: { icon: IconRss, tone: 'amber' },
  kml: { icon: IconMapPin, tone: 'green' },
  gpx: { icon: IconRoute, tone: 'green' },
  json: { icon: IconBraces, tone: 'amber' },
  geojson: { icon: IconMapPin, tone: 'green' },
  jsonld: { icon: IconBraces, tone: 'teal' },
  webmanifest: { icon: IconDeviceMobile, tone: 'teal' },
  har: { icon: IconWorldWww, tone: 'blue' },
  ipynb: { icon: IconNotebook, tone: 'amber' },
  sql: { icon: IconDatabase, tone: 'pink' },
  ddl: { icon: IconDatabase, tone: 'pink' },
  dml: { icon: IconDatabase, tone: 'pink' },
  zpl: { icon: IconBarcode, tone: 'red' },
  md: { icon: IconMarkdown, tone: 'blue' },
  markdown: { icon: IconMarkdown, tone: 'blue' },
  dat: { icon: IconTable, tone: 'green' },
  txt: { icon: IconFileText },
  text: { icon: IconFileText },
  log: { icon: IconLogs },
  gif: { icon: IconGif, tone: 'purple' },
}

// Files without a known extension take their language's look.
const LANGUAGES: Record<DocLanguage, FileLook> = {
  xml: EXTENSIONS.xml,
  json: EXTENSIONS.json,
  flat: EXTENSIONS.dat,
  sql: EXTENSIONS.sql,
  zpl: EXTENSIONS.zpl,
  md: EXTENSIONS.md,
  txt: EXTENSIONS.txt,
  image: { icon: IconPhoto, tone: 'purple' },
}

/** How a file named `name` looks in lists and tabs, as an editor icon theme. */
export function fileLook(name: string): FileLook {
  for (const [pattern, look] of NAMES) if (pattern.test(name)) return look
  const dot = name.lastIndexOf('.')
  const extension = dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
  return EXTENSIONS[extension] ?? LANGUAGES[languageOf(name, '')]
}

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
