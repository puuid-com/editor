import { eq, useLiveQuery } from '@tanstack/react-db'
import { useSelector } from '@tanstack/react-store'

import { filesCollection } from '#/lib/store/files'
import { withDefaults } from '#/lib/store/format-settings'
import { DEFAULT_PROFILE_ID } from '#/lib/store/persist'
import { profilesCollection, resolveProfile } from '#/lib/store/profiles'
import { sessionStore } from '#/lib/store/session'

/** Every profile, oldest first. */
export function useProfiles() {
  const { data } = useLiveQuery((q) =>
    q
      .from({ profile: profilesCollection })
      .orderBy(({ profile }) => profile.createdAt, 'asc')
      .orderBy(({ profile }) => profile.id, 'asc'),
  )
  return data
}

/** The profile of the active file, whose settings the editor uses. */
export function useActiveProfile(forFileId?: string) {
  const profiles = useProfiles()
  const activeId = useSelector(sessionStore, (s) => s.activeId)
  const fileId = forFileId ?? activeId
  const { data } = useLiveQuery({
    query: (q) =>
      q
        .from({ file: filesCollection })
        .where(({ file }) => eq(file.id, fileId ?? ''))
        .select(({ file }) => ({ profileId: file.profileId })),
  })
  return resolveProfile(profiles, data.at(0)?.profileId)
}

export function useActiveProfileId(fileId?: string) {
  return useActiveProfile(fileId)?.id ?? DEFAULT_PROFILE_ID
}

export function useFormatSettings(fileId?: string) {
  return withDefaults(useActiveProfile(fileId)?.format)
}

/** How many files each profile holds, by profile id: how much it's used. */
export function useProfileFileCounts() {
  const { data } = useLiveQuery((q) =>
    q
      .from({ file: filesCollection })
      .select(({ file }) => ({ id: file.id, profileId: file.profileId })),
  )
  const counts = new Map<string, number>()
  for (const { profileId } of data)
    counts.set(profileId, (counts.get(profileId) ?? 0) + 1)
  return counts
}
