import { afterEach, describe, expect, it, vi } from 'vitest'
import { waitForPdfContent } from './print'
import { preparePdfLinks } from './links'

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('print readiness', () => {
  it('waits for every note, diagram and image before printing', async () => {
    document.body.innerHTML =
      '<article><figure data-pdf-state="pending"></figure><img src="data:image/png;base64,AA=="></article>'
    const img = document.images[0]
    Object.defineProperty(img, 'complete', { value: false, configurable: true })
    let ready = false
    const promise = waitForPdfContent(
      document,
      2,
      new AbortController().signal,
    ).then(() => {
      ready = true
    })
    document.body.appendChild(document.createElement('article'))
    document.querySelector('figure')!.setAttribute('data-pdf-state', 'ready')
    await Promise.resolve()
    expect(ready).toBe(false)
    Object.defineProperty(img, 'complete', { value: true })
    Object.defineProperty(img, 'naturalWidth', { value: 10 })
    img.dispatchEvent(new Event('load'))
    await promise
    expect(ready).toBe(true)
  })

  it('rejects broken assets, timeouts and cancellation', async () => {
    document.body.innerHTML =
      '<article><span data-pdf-state="error"></span></article>'
    await expect(
      waitForPdfContent(document, 1, new AbortController().signal),
    ).rejects.toThrow('could not load')
    document.body.innerHTML =
      '<article><span data-pdf-state="pending"></span></article>'
    const abort = new AbortController()
    const canceled = waitForPdfContent(document, 1, abort.signal)
    abort.abort()
    await expect(canceled).rejects.toHaveProperty('name', 'AbortError')
    vi.useFakeTimers()
    const timeout = expect(
      waitForPdfContent(document, 1, new AbortController().signal),
    ).rejects.toThrow('too long')
    await vi.advanceTimersByTimeAsync(60_000)
    await timeout
  })
})

describe('PDF destinations', () => {
  it('keeps repeated headings and SVG references distinct, resolves note links and preserves external links', () => {
    document.body.innerHTML = `
      <section data-pdf-note="A.md"><article><h1 id="intro">Intro</h1>
        <a href="#intro">local</a><a href="B.md#intro">relative</a>
        <a href="B.md" data-note-path="B.md" data-note-heading="Intro">wiki</a>
        <a href="https://example.com">external</a>
        <svg id="diagram"><style>#diagram .node { fill: #fff; } #diagram path { marker-end: url(#arrow); }</style><defs><marker id="arrow" /></defs><path marker-end="url(#arrow)" /></svg>
      </article></section>
      <section data-pdf-note="B.md"><article><h1 id="intro">Intro</h1>
        <svg id="diagram"><style>#diagram .node { fill: #fff; } #diagram path { marker-end: url(#arrow); }</style><defs><marker id="arrow" /></defs><path marker-end="url(#arrow)" /></svg>
      </article></section>`
    // Reusing the same diagram in one note must not redirect its CSS or arrows.
    document
      .querySelector('article')!
      .appendChild(document.querySelector('svg')!.cloneNode(true))
    preparePdfLinks(document)
    const headings = [...document.querySelectorAll('h1')]
    const links = [...document.querySelectorAll('a')]
    expect(headings[0].id).not.toBe(headings[1].id)
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      `#${headings[0].id}`,
      `#${headings[1].id}`,
      `#${headings[1].id}`,
      'https://example.com',
    ])
    expect(document.querySelector('svg style')!.textContent).toContain(
      `#${document.querySelector('svg')!.id} .node { fill: #fff; }`,
    )
    const markers = [...document.querySelectorAll('marker')]
    expect(
      [...document.querySelectorAll('path')].map((path) =>
        path.getAttribute('marker-end'),
      ),
    ).toEqual(markers.map((marker) => `url(#${marker.id})`))
  })
})
