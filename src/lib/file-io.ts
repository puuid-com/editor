// Browser file transfers that don't go through the File System Access API:
// downloads, and the file picker of an `<input type="file">`.

/** Saves `blob` to the downloads folder as `name`. */
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  // Revoking during the click can cancel the download in Firefox and Safari.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Asks for one file of the `accept` types, then hands it to `onPick`. */
export function pickFile(accept: string, onPick: (file: File) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (file) onPick(file)
  })
  input.click()
}
