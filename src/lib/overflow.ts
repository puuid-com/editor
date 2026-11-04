/**
 * Splits `items` into the ones a crowded bar shows and the ones it tucks into
 * a menu. The `max` with the highest `weight` stay visible, ties going to the
 * earlier item, and `keep` (say, the active one) is always among them. Both
 * lists keep the original order, so items don't jump around as weights change.
 */
export function splitOverflow<T>(
  items: ReadonlyArray<T>,
  max: number,
  weight: (item: T) => number,
  keep?: (item: T) => boolean,
): { shown: Array<T>; hidden: Array<T> } {
  if (items.length <= max) return { shown: [...items], hidden: [] }
  const ranked = items
    .map((item, index) => ({ item, index, w: weight(item) }))
    .sort((a, b) => b.w - a.w || a.index - b.index)
  const top = ranked.slice(0, max)
  const kept = keep && ranked.find((r) => keep(r.item))
  if (kept && !top.includes(kept)) top[max - 1] = kept
  const picked = new Set(top.map((r) => r.index))
  return {
    shown: items.filter((_, i) => picked.has(i)),
    hidden: items.filter((_, i) => !picked.has(i)),
  }
}
