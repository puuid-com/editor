import { base64ToBytes, bytesToBase64 } from './base64'

/** Browser-native image formats; SVG stays text for lossless export. */
export const IMAGE_TYPES: Record<string, Array<`.${string}`>> = {
  'image/png': ['.png'],
  'image/apng': ['.apng'],
  'image/jpeg': ['.jpg', '.jpeg', '.jfif'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/avif': ['.avif'],
  'image/bmp': ['.bmp'],
  'image/x-icon': ['.ico'],
  'image/svg+xml': ['.svg'],
}

export function imageMime(name = '') {
  const extension = `.${name.split('.').at(-1)?.toLowerCase()}`
  return Object.entries(IMAGE_TYPES).find(([, extensions]) =>
    extensions.some((ext) => ext === extension),
  )?.[0]
}

export function isImageData(content: string) {
  return /^data:image\/(png|apng|jpeg|gif|webp|avif|bmp|x-icon);base64,/.test(
    content,
  )
}

/** Keep binary bytes in the existing persistent string content field. */
export async function readFileContent(file: File): Promise<string> {
  const mime = imageMime(file.name)
  if (!mime || mime === 'image/svg+xml') return file.text()
  const bytes = new Uint8Array(await file.arrayBuffer())
  return `data:${mime};base64,${bytesToBase64(bytes)}`
}

/** Decode image storage before any download or write to disk. */
export function contentBlob(content: string, mime = 'text/plain') {
  if (!isImageData(content)) return new Blob([content], { type: mime })
  const bytes = base64ToBytes(content.slice(content.indexOf(',') + 1))
  return new Blob([bytes], { type: content.slice(5, content.indexOf(';')) })
}
