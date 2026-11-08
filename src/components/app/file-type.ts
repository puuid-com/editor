import { imageMime, isImageData } from '#/lib/image-file'
import { useFileContent } from '#/hooks/use-files'
import { languageOf, typedName } from '#/lib/document'
import { filesCollection, renameFile, uniqueName } from '#/lib/store/files'
import { isFlatFile } from '#/lib/flat/parse'
import { m } from '#/paraglide/messages'
import type { DocLanguage } from '#/lib/document'

export const FILE_TYPES: Array<{ value: DocLanguage; label: () => string }> = [
  { value: 'xml', label: m.paste_type_xml },
  { value: 'json', label: m.paste_type_json },
  { value: 'flat', label: m.paste_type_flat },
  { value: 'sql', label: m.paste_type_sql },
  { value: 'zpl', label: m.paste_type_zpl },
  { value: 'md', label: m.paste_type_md },
  { value: 'txt', label: m.paste_type_txt },
]

/**
 * Whether a file can be read as `language`. Fixed-width records read as such
 * whatever the name says, and nothing else does. An empty file can be any.
 */
export function canReadAs(content: string, language: DocLanguage) {
  if (isImageData(content)) return false
  if (content.trim() === '') return true
  return isFlatFile(content) === (language === 'flat')
}

/** A file's current type and the content that limits what it can become. */
export function useFileType(id: string) {
  const file = useFileContent(id)
  if (!file || imageMime(file.name) || isImageData(file.content)) return null
  return {
    language: languageOf(file.name, file.content),
    content: file.content,
  }
}

/** Gives the file the extension of `language`, so it is read as that type. */
export async function setFileType(id: string, language: DocLanguage) {
  const file = filesCollection.get(id)
  if (!file || imageMime(file.name) || isImageData(file.content)) return
  const name = typedName(file.name, language)
  if (name !== file.name)
    await renameFile(id, uniqueName(name))?.isPersisted.promise
}
