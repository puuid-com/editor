import { Compartment } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { decodeBase64Zpl } from '#/lib/zpl/base64'

export const zplHelpCompartment = new Compartment()

/** Puts a base64 label in as the ZPL it encodes. False when `text` isn't one. */
function insertDecoded(
  event: Event,
  view: EditorView,
  text: string | undefined,
) {
  const decoded = text ? decodeBase64Zpl(text) : null
  if (!decoded) return false
  event.preventDefault()
  view.dispatch(view.state.replaceSelection(decoded), {
    userEvent: 'input.paste',
    scrollIntoView: true,
  })
  return true
}

export const zplBase64Input = EditorView.domEventHandlers({
  paste: (event, view) =>
    insertDecoded(event, view, event.clipboardData?.getData('text/plain')),
  drop: (event, view) =>
    // Dropped files open in tabs of their own.
    !event.dataTransfer?.files.length &&
    insertDecoded(event, view, event.dataTransfer?.getData('text/plain')),
})
