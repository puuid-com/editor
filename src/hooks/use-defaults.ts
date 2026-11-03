import { eq, useLiveQuery } from '@tanstack/react-db'
import { useMemo } from 'react'

import { useActiveProfileId } from './use-profiles'
import { defaultsCollection } from '#/lib/store/defaults'
import type { DefaultRule } from '#/lib/xml/defaults'

/** Default-value rules of the active profile, oldest first. */
export function useDefaults(fileId?: string) {
  const profileId = useActiveProfileId(fileId)
  const { data } = useLiveQuery({
    query: (q) =>
      q
        .from({ rule: defaultsCollection })
        .where(({ rule }) => eq(rule.profileId, profileId))
        .orderBy(({ rule }) => rule.createdAt, 'asc'),
  })
  return data
}

/** The rules that are switched on. */
export function useEnabledDefaults(
  fileId?: string,
): ReadonlyArray<DefaultRule> {
  const rules = useDefaults(fileId)
  return useMemo(() => rules.filter((r) => r.enabled), [rules])
}
