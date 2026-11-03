import { isPreset } from '#/lib/store/colors'
import { m } from '#/paraglide/messages'
import type { HighlightPreset } from '#/lib/store/colors'

const presetLabels: Record<HighlightPreset, () => string> = {
  blue: m.color_blue,
  purple: m.color_purple,
  pink: m.color_pink,
  red: m.color_red,
  amber: m.color_amber,
  green: m.color_green,
  teal: m.color_teal,
  gray: m.color_gray,
}

/** Accessible name for a swatch: the preset's name or the hex value. */
export function colorLabel(color: string) {
  return isPreset(color) ? presetLabels[color]() : color
}
