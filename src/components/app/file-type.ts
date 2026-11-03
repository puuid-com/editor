import { useFileContent } from '#/hooks/use-files'
import {
  LANGUAGE_EXTENSIONS,
  extensionOf,
  languageOf,
  typedName,
  withExtension,
} from '#/lib/document'
import { filesCollection, renameFile, uniqueName } from '#/lib/store/files'
import { isFlatFile } from '#/lib/flat/parse'
import { m } from '#/paraglide/messages'
import type { DocLanguage } from '#/lib/document'

export const FILE_TYPES: Array<{ value: DocLanguage; label: () => string }> = [
  { value: 'xml', label: m.paste_type_xml },
  { value: 'json', label: m.paste_type_json },
  { value: 'flat', label: m.paste_type_flat },
  { value: 'sql', label: m.paste_type_sql },
]

/**
 * Whether a file can be read as `language`. Fixed-width records read as such
 * whatever the name says, and nothing else does.
 */
export function canReadAs(content: string, language: DocLanguage) {
  return isFlatFile(content) === (language === 'flat')
}

/** A file's current type and the content that limits what it can become. */
export function useFileType(id: string) {
  const file = useFileContent(id)
  if (!file) return null
  return {
    language: languageOf(file.name, file.content),
    extension: extensionOf(file.name),
    content: file.content,
  }
}

/** Each type with the extensions it is read from, its usual one first. */
export const FILE_EXTENSIONS = FILE_TYPES.map((type) => ({
  ...type,
  extensions: LANGUAGE_EXTENSIONS[type.value],
}))

/** Gives the file the extension of `language`, so it is read as that type. */
export function setFileType(id: string, language: DocLanguage) {
  return renameTo(id, (name) => typedName(name, language))
}

/** Swaps the file's extension, which also sets the type it is read as. */
export function setFileExtension(id: string, extension: string) {
  return renameTo(id, (name) => withExtension(name, extension))
}

async function renameTo(id: string, rename: (name: string) => string) {
  const file = filesCollection.get(id)
  if (!file) return
  const name = rename(file.name)
  if (name !== file.name)
    await renameFile(id, uniqueName(name))?.isPersisted.promise
}
