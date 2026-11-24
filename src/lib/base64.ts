// Base64 for bytes, plain or URL-safe. `btoa` and `atob` work on binary
// strings, one character per byte.

/** How many bytes go to `String.fromCharCode` in one call. */
const SLICE = 8192

export function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  // In slices: a call per byte is slow on a large image, and one call for
  // every byte can pass more arguments than the engine allows.
  for (let i = 0; i < bytes.length; i += SLICE)
    binary += String.fromCharCode(...bytes.subarray(i, i + SLICE))
  return btoa(binary)
}

/** Throws when `text` isn't base64. Its padding is optional. */
export function base64ToBytes(text: string) {
  const binary = atob(text)
  // A plain loop: `Uint8Array.from` with a mapper calls it per byte through
  // the string's iterator, many times slower on a large image.
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Base64 that a URL carries as is: `-` and `_` for `+` and `/`, no padding. */
export function toBase64Url(bytes: Uint8Array) {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function fromBase64Url(text: string) {
  return base64ToBytes(text.replace(/-/g, '+').replace(/_/g, '/'))
}
