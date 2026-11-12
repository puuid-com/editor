import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { zplHelpCompartment } from './editor-support'
import { loadZplExplanations, zpl, zplHelp } from './zpl-language'

const LABEL = '^XA\n^FO50,50^A0N,40^FDHello^FS\n^XZ'

let view: EditorView | undefined
afterEach(() => view?.destroy())

function editor(explain: boolean) {
  view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc: LABEL,
      extensions: [
        zpl(),
        zplHelpCompartment.of(zplHelp({ dpi: 203, explain })),
      ],
    }),
  })
  return view
}

const hints = (target: EditorView) =>
  target.dom.querySelectorAll('.cm-zpl-hint').length

describe('ZPL explanations', () => {
  it('show once the parser they need has loaded', async () => {
    const target = editor(true)
    await loadZplExplanations()
    await vi.waitFor(() => expect(hints(target)).toBeGreaterThan(0))
  })

  it('follow the setting that turns them off and on', async () => {
    const target = editor(false)
    await loadZplExplanations()
    // Loaded, but switched off.
    await Promise.resolve()
    expect(hints(target)).toBe(0)

    target.dispatch({
      effects: zplHelpCompartment.reconfigure(
        zplHelp({ dpi: 203, explain: true }),
      ),
    })
    expect(hints(target)).toBeGreaterThan(0)
  })

  it('leave an editor that closed before they loaded alone', async () => {
    const target = editor(true)
    target.destroy()
    await expect(loadZplExplanations()).resolves.toBeDefined()
  })
})
