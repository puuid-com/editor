import { sameName } from '#/lib/names'

// Tags a profile marks as holding a ZPL label, base64-encoded, open in the
// shared workspace, which decodes a `base64` fragment parameter.

/** Whether `name` is one of the tags marked as ZPL labels. */
export function isZplTag(tags: ReadonlyArray<string>, name: string) {
  return tags.some((tag) => sameName(tag, name))
}

/** Link that opens a base64 ZPL label in the viewer, or null when empty. */
export function zplViewerUrl(base64: string) {
  // Base64 wrapped over several lines still decodes once joined.
  const data = base64.replace(/\s+/g, '')
  if (!data) return null
  return '/#' + new URLSearchParams({ base64: data }).toString()
}

/** Opens a base64 ZPL label beside the current document. */
export function openZplLabel(base64: string) {
  void import('#/components/zpl/open-label').then(({ openLabel }) =>
    openLabel(base64),
  )
}
