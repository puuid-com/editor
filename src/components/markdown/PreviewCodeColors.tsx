import { useEffect, useMemo, useState } from 'react'
import type { RefObject } from 'react'

import { CodeColorPicker } from './CodeColorPicker'
import { inlineCodes, recolor } from './md-code-colors'
import { getFileView } from '#/components/editor/editor-store'
import { fileIdField } from '#/components/editor/extensions'
import { Popover, PopoverAnchor, PopoverContent } from '#/components/ui/popover'
import type { HighlightPreset } from '#/lib/store/colors'

/** The preview's inline code that is the file's own, in order. */
function ownCode(article: HTMLElement) {
  return [...article.querySelectorAll('code')].filter(
    (code) => !code.closest('pre, [data-note-embed]'),
  )
}

/** The code a click lands on, unless it's a link or picks out text. */
function clickedCode(target: EventTarget | null, article: HTMLElement) {
  const code = target instanceof Element ? target.closest('code') : null
  if (!code || code.closest('a') || !ownCode(article).includes(code))
    return null
  return document.getSelection()?.isCollapsed === false ? null : code
}

/**
 * Colours the source of code shown in the preview. The preview keeps no
 * positions, so it is the same code as the one there: the nth with its text.
 */
function colorSource(
  fileId: string,
  article: HTMLElement,
  shown: HTMLElement,
  color: HighlightPreset | null,
) {
  const view = getFileView(fileId)
  if (!view || view.state.field(fileIdField, false) !== fileId) return
  const text = shown.textContent
  const nth = ownCode(article)
    .filter((code) => code.textContent === text)
    .indexOf(shown)
  if (nth < 0) return
  const code = inlineCodes(view.state)
    .filter((c) => c.text === text)
    .at(nth)
  const edit = code && recolor(view.state, code, color)
  if (edit)
    view.dispatch({
      changes: { from: edit.from, to: edit.to, insert: edit.insert },
      userEvent: 'input',
    })
}

/** Clicking inline code in the preview offers its colours, as the editor does. */
export function PreviewCodeColors({
  fileId,
  contentRef,
}: {
  fileId: string
  contentRef: RefObject<HTMLElement | null>
}) {
  const [shown, setShown] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const article = contentRef.current
    if (!article) return
    const open = (event: MouseEvent) => {
      const code = clickedCode(event.target, article)
      if (code) setShown(code)
    }
    article.addEventListener('click', open)
    return () => article.removeEventListener('click', open)
  }, [contentRef])
  const anchor = useMemo(() => ({ current: shown }), [shown])
  const pick = (color: HighlightPreset | null) => {
    if (shown && contentRef.current)
      colorSource(fileId, contentRef.current, shown, color)
    setShown(null)
  }
  return (
    <Popover
      open={shown !== null}
      onOpenChange={(open) => {
        if (!open) setShown(null)
      }}
    >
      <PopoverAnchor virtualRef={anchor} />
      {/* Opened by a click: focusing a swatch would cover the code with its name. */}
      <PopoverContent
        side="top"
        align="start"
        className="w-auto p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <CodeColorPicker value={shown?.dataset.color} onSelect={pick} />
      </PopoverContent>
    </Popover>
  )
}
