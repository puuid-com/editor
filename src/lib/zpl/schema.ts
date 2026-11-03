import { z } from 'zod'
import { DEFAULT_SETTINGS, MAX_SIZE_IN, MIN_SIZE_IN } from './settings'

export const labelSettingsSchema = z.object({
  dpmm: z.union([z.literal(6), z.literal(8), z.literal(12), z.literal(24)]),
  widthIn: z.number().min(MIN_SIZE_IN).max(MAX_SIZE_IN),
  heightIn: z.number().min(MIN_SIZE_IN).max(MAX_SIZE_IN),
})

export function normalizeSettings(settings: Record<string, unknown>) {
  return {
    dpmm:
      labelSettingsSchema.shape.dpmm.safeParse(settings.dpmm).data ??
      DEFAULT_SETTINGS.dpmm,
    widthIn:
      labelSettingsSchema.shape.widthIn.safeParse(settings.widthIn).data ??
      DEFAULT_SETTINGS.widthIn,
    heightIn:
      labelSettingsSchema.shape.heightIn.safeParse(settings.heightIn).data ??
      DEFAULT_SETTINGS.heightIn,
  }
}
