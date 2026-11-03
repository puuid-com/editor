import { Compartment } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { decodeBase64Zpl } from '#/lib/zpl/base64'

export const zplHelpCompartment = new Compartment()

export const zplBase64Input = EditorView.domEventHandlers({
  paste(event, view) {
    const text = event.clipboardData?.getData('text/plain')
    const decoded = text ? decodeBase64Zpl(text) : null
    if (!decoded) return false
    event.preventDefault()
    view.dispatch(view.state.replaceSelection(decoded), {
      userEvent: 'input.paste',
      scrollIntoView: true,
    })
    return true
  },
  drop(event, view) {
    if (event.dataTransfer?.files.length) return false
    const text = event.dataTransfer?.getData('text/plain')
    const decoded = text ? decodeBase64Zpl(text) : null
    if (!decoded) return false
    event.preventDefault()
    view.dispatch(view.state.replaceSelection(decoded), {
      userEvent: 'input.paste',
      scrollIntoView: true,
    })
    return true
  },
})
