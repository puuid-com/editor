import { eq, useLiveQuery } from '@tanstack/react-db'
import { useMemo } from 'react'

import { useActiveProfileId } from './use-profiles'
import { localName } from '#/lib/names'
import { swatchColors } from '#/lib/store/colors'
import { highlightCss, highlightsCollection } from '#/lib/store/highlights'

/** Highlight rules of the active profile, oldest first. */
export function useHighlights(fileId?: string) {
  const profileId = useActiveProfileId(fileId)
  const { data } = useLiveQuery({
    query: (q) =>
      q
        .from({ rule: highlightsCollection })
        .where(({ rule }) => eq(rule.profileId, profileId))
        .orderBy(({ rule }) => rule.createdAt, 'asc'),
  })
  return data
}

/** Enabled rules as local tag name (no prefix) → CSS colour. */
export function useHighlightMap(fileId?: string): ReadonlyMap<string, string> {
  const rules = useHighlights(fileId)
  return useMemo(
    () =>
      new Map(
        rules
          .filter((r) => r.enabled)
          .map((r) => [localName(r.tag), highlightCss(r.color)]),
      ),
    [rules],
  )
}

/** Swatches for picking a highlight: the profile's colours, then presets. */
export function useHighlightSwatches(fileId?: string): Array<string> {
  const rules = useHighlights(fileId)
  return useMemo(() => swatchColors(rules.map((r) => r.color)), [rules])
}
