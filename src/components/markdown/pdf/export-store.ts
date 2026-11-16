import { Store } from '@tanstack/store'

import type { PdfSource } from './source'

// What the export dialog is asked to print. Kept apart from the dialog,
// which loads the first time it opens.

export const exportStore = new Store<{ source: PdfSource; key: number } | null>(
  null,
)
let nextKey = 0

/** Opens the dialog that prints a note, or a folder of them, to PDF. */
export function exportMarkdownPdf(source: PdfSource) {
  exportStore.setState(() => ({ source, key: ++nextKey }))
}

export function closePdfExport() {
  exportStore.setState(() => null)
}
