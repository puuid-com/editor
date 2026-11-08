import { setFileType } from './file-type'
import { setPasteChoice } from './ui-store'
import { detectLanguage, languageOf, typedName } from '#/lib/document'
import { filesCollection, setFileProfile } from '#/lib/store/files'
import { learnSample, profileGuesser } from '#/lib/store/profiles'
import type { PasteChoice } from './ui-store'

/**
 * Offers to change a file's type when content pasted over all of it reads as
 * another type, or when nothing gives its type away. Pasting the type the
 * file already has just gives it that extension.
 */
export function askPasteChoice(fileId: string, text: string) {
  const file = filesCollection.get(fileId)
  if (!file) return
  const detected = detectLanguage(text)
  const current = languageOf(file.name, text)
  // Labels and Markdown have no profile to pick, so they switch on their own.
  if (detected === 'zpl' || detected === 'md' || detected === current) {
    setPasteChoice(null)
    void setFileType(fileId, detected)
    return
  }
  // Notes and plain text take any text, so there is nothing to ask.
  if (!detected && (current === 'md' || current === 'txt')) {
    setPasteChoice(null)
    return
  }
  const language = detected ?? current
  const guessed = profileGuesser(fileId)(typedName(file.name, language), text)
  setPasteChoice({
    fileId,
    current,
    detected,
    language,
    profileId: guessed ?? file.profileId,
    bestMatch: guessed,
  })
}

/** Gives the file the extension of its type and moves it to the profile. */
export async function applyPasteChoice({
  fileId,
  language,
  profileId,
}: Pick<PasteChoice, 'fileId' | 'language' | 'profileId'>) {
  const file = filesCollection.get(fileId)
  if (!file) return
  await setFileType(fileId, language)
  await setFileProfile(fileId, profileId)
  const typed = filesCollection.get(fileId)
  learnSample(profileId, typed?.name ?? '', typed?.content ?? '')
}
