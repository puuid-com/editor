import type { DocLanguage } from './xml/model'

// On its own, away from the parsers in `document.ts`: pages that only name
// the file types, like the changelog, don't load the editor's grammars.

/** Extensions read as each language, the file pickers' list included. */
export const LANGUAGE_EXTENSIONS = {
  xml: [
    '.xml',
    '.xsd',
    '.xsl',
    '.xslt',
    '.wsdl',
    '.svg',
    '.plist',
    '.config',
    '.csproj',
    '.xaml',
    '.rss',
    '.atom',
    '.kml',
    '.gpx',
  ],
  json: ['.json', '.geojson', '.jsonld', '.webmanifest', '.har', '.ipynb'],
  flat: ['.txt', '.dat'],
  sql: ['.sql', '.ddl', '.dml'],
  zpl: ['.zpl'],
  md: ['.md', '.markdown'],
  txt: ['.txt', '.text', '.log'],
  image: [
    '.png',
    '.jpg',
    '.jpeg',
    '.jfif',
    '.gif',
    '.webp',
    '.avif',
    '.bmp',
    '.ico',
    '.apng',
  ],
} as const satisfies Record<DocLanguage, ReadonlyArray<`.${string}`>>
