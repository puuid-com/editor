// Kept apart from open-label.ts so tree rows, pins and editor links can
// offer "open label" without pulling the ZPL tools into the main bundle.

/** Opens a base64 ZPL label beside the current document. */
export function openZplLabel(base64: string) {
  void import('./open-label').then(({ openLabel }) => openLabel(base64))
}
