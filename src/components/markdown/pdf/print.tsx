import { QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'

import { TooltipProvider } from '#/components/ui/tooltip'
import { LightOnly } from '#/hooks/use-dark-mode'
import { MarkdownDocument } from '../MarkdownPreview'
import { preparePdfLinks } from './links'
import { collectPdfNotes } from './source'
import type { PdfSource } from './source'
import { browserQueryClient } from '#/integrations/tanstack-query/root-provider'
import { m } from '#/paraglide/messages'
import printStyles from './print.css?inline'

/**
 * Native print preserves the preview's CSS, SVG, selectable text and links.
 * The frame stays alive until the dialog is closed (Safari prints asynchronously).
 */
export async function preparePdf(source: PdfSource, signal: AbortSignal) {
  const { name, notes } = await collectPdfNotes(source)
  signal.throwIfAborted()
  const frame = document.createElement('iframe')
  frame.title = m.md_pdf_export()
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1
  // Laid out, not display:none: fonts, images and Mermaid need real dimensions.
  frame.style.cssText =
    'position:fixed;left:-10000px;top:0;width:182mm;height:269mm;border:0;pointer-events:none'
  document.body.appendChild(frame)
  const doc = frame.contentDocument!
  const win = frame.contentWindow!
  doc.title = name
  doc.documentElement.lang = document.documentElement.lang
  // Paper is white: the PDF is always light, whatever the app's theme.
  doc.documentElement.className = document.documentElement.className
  doc.documentElement.classList.remove('dark')
  const container = doc.createElement('div')
  doc.body.appendChild(container)
  const objectUrls: Array<string> = []
  let mounted = true
  let previousTitle: string | undefined
  const restoreTitle = () => {
    if (previousTitle !== undefined) document.title = previousTitle
    previousTitle = undefined
  }
  win.addEventListener('afterprint', restoreTitle)
  const root = createRoot(container, {
    onUncaughtError: () => {
      doc.body.dataset.pdfState = 'error'
    },
  })
  const dispose = () => {
    restoreTitle()
    win.removeEventListener('afterprint', restoreTitle)
    if (mounted) {
      root.unmount()
      mounted = false
    }
    for (const url of objectUrls) URL.revokeObjectURL(url)
    frame.remove()
  }
  signal.addEventListener('abort', dispose, { once: true })
  try {
    const styles = [
      ...document.querySelectorAll('style, link[rel="stylesheet"]'),
    ].map((style) => {
      const copy = style.cloneNode(true) as HTMLStyleElement | HTMLLinkElement
      if (style instanceof HTMLLinkElement)
        (copy as HTMLLinkElement).href = style.href
      const loaded =
        copy.tagName === 'LINK'
          ? new Promise<void>((resolve, reject) => {
              copy.onload = () => resolve()
              copy.onerror = () => reject(new Error(m.md_pdf_failed()))
            })
          : Promise.resolve()
      doc.head.appendChild(copy)
      return loaded
    })
    const css = doc.createElement('style')
    css.textContent = printStyles
    doc.head.appendChild(css)
    await bounded(Promise.all(styles), signal)
    await bounded(document.fonts.ready, signal)
    signal.throwIfAborted()
    root.render(
      <QueryClientProvider client={browserQueryClient()}>
        <TooltipProvider>
          <LightOnly value>
            {notes.map((note, index) => (
              <section key={index} data-pdf-note={note.path}>
                {notes.length > 1 && (
                  <div className="mb-5 border-b pb-2 font-mono text-xs text-muted-foreground">
                    {note.path}
                  </div>
                )}
                <MarkdownDocument
                  source={note.content}
                  location={note.location}
                />
              </section>
            ))}
          </LightOnly>
        </TooltipProvider>
      </QueryClientProvider>,
    )
    await waitForPdfContent(doc, notes.length, signal)
    await bounded(doc.fonts.ready, signal)
    signal.throwIfAborted()
    // Freeze the ready render so query refetches/theme changes cannot alter a
    // document while the browser's print dialog is open. Own blob URLs before
    // unmounting the preview, whose image hooks release their originals.
    const snapshot = container.cloneNode(true) as HTMLElement
    await bounded(
      Promise.all(
        [...snapshot.querySelectorAll('img')].map(async (img) => {
          if (!img.src.startsWith('blob:')) return
          const blob = await (await fetch(img.src, { signal })).blob()
          signal.throwIfAborted()
          const url = URL.createObjectURL(blob)
          objectUrls.push(url)
          img.src = url
        }),
      ),
      signal,
    )
    signal.throwIfAborted()
    root.unmount()
    mounted = false
    container.replaceWith(snapshot)
    await waitForPdfContent(doc, notes.length, signal)
    preparePdfLinks(doc)
    return {
      count: notes.length,
      name,
      print: () => {
        previousTitle ??= document.title
        document.title = name
        try {
          win.print()
        } catch (error) {
          restoreTitle()
          throw error
        }
      },
    }
  } catch (error) {
    signal.removeEventListener('abort', dispose)
    dispose()
    throw error
  }
}

/** Never silently export a partial document when an asset fails or stalls. */
export function waitForPdfContent(
  doc: Document,
  count: number,
  signal: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: unknown) => {
      clearTimeout(timeout)
      observer.disconnect()
      doc.removeEventListener('load', check, true)
      doc.removeEventListener('error', check, true)
      signal.removeEventListener('abort', abort)
      if (error) reject(error)
      else resolve()
    }
    const check = () => {
      if (doc.querySelector('[data-pdf-state="error"]')) {
        finish(new Error(m.md_pdf_assets_failed()))
        return
      }
      const images = [...doc.images]
      if (images.some((img) => img.complete && !img.naturalWidth)) {
        finish(new Error(m.md_pdf_assets_failed()))
        return
      }
      if (
        doc.querySelectorAll('article').length === count &&
        !doc.querySelector('[data-pdf-state="pending"]') &&
        images.every((img) => img.complete && img.naturalWidth > 0)
      )
        finish()
    }
    const abort = () => finish(signal.reason)
    const observer = new MutationObserver(check)
    const timeout = setTimeout(
      () => finish(new Error(m.md_pdf_timeout())),
      60_000,
    )
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
    })
    doc.addEventListener('load', check, true)
    doc.addEventListener('error', check, true)
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    else check()
  })
}

function bounded<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
    }
    const fail = (error: unknown) => {
      cleanup()
      reject(error)
    }
    const abort = () => fail(signal.reason)
    const timeout = setTimeout(
      () => fail(new Error(m.md_pdf_timeout())),
      60_000,
    )
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    void promise.then((value) => {
      cleanup()
      resolve(value)
    }, fail)
  })
}
