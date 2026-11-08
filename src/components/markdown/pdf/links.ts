import { hrefPath, isLocalHref, linkResolver } from '#/lib/obsidian'

/** Namespace duplicate headings/SVG ids and turn links between included notes into PDF destinations. */
export function preparePdfLinks(doc: Document) {
  const sections = [...doc.querySelectorAll<HTMLElement>('[data-pdf-note]')]
  const byPath = new Map(
    sections.map((section) => [section.dataset.pdfNote!, section]),
  )
  const resolve = linkResolver([...byPath.keys()])
  const ids = new Map<HTMLElement, Map<string, string>>()
  sections.forEach((section, index) => {
    section.id = `pdf-note-${index}`
    const renamed = new Map<string, string>()
    section.querySelectorAll('[id]').forEach((element, n) => {
      if (element.closest('svg')) return
      const next = `${section.id}-${n}`
      renamed.set(element.id, next)
      element.id = next
    })
    ids.set(section, renamed)
    // Each cached diagram can occur more than once, even in the same note.
    section.querySelectorAll('svg').forEach((svg, diagram) => {
      const svgIds = new Map<string, string>()
      ;[svg, ...svg.querySelectorAll('[id]')].forEach((element, n) => {
        if (!element.id) return
        const next = `${section.id}-svg-${diagram}-${n}`
        svgIds.set(element.id, next)
        element.id = next
      })
      for (const style of svg.querySelectorAll('style')) {
        style.textContent = style.textContent.replace(
          /#([a-zA-Z_][\w:-]*)/g,
          (match, id: string) =>
            svgIds.has(id) ? `#${svgIds.get(id)}` : match,
        )
      }
      for (const element of [svg, ...svg.querySelectorAll('*')]) {
        for (const attribute of [...element.attributes]) {
          if (attribute.name === 'id') continue
          let value = attribute.value.replace(
            /url\(#([^)]*)\)/g,
            (match, id: string) =>
              svgIds.has(id) ? `url(#${svgIds.get(id)})` : match,
          )
          if (
            ['href', 'xlink:href'].includes(attribute.name) &&
            value.startsWith('#')
          ) {
            value = `#${svgIds.get(value.slice(1)) ?? value.slice(1)}`
          }
          if (value !== attribute.value)
            element.setAttribute(attribute.name, value)
        }
      }
    })
  })
  for (const section of sections) {
    for (const link of section.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      const href = link.getAttribute('href')!
      const path =
        link.dataset.notePath ??
        (isLocalHref(href)
          ? resolve(hrefPath(href), section.dataset.pdfNote!)
          : undefined)
      const target = path
        ? byPath.get(path)
        : href.startsWith('#')
          ? section
          : undefined
      if (!target) continue
      const fragment = link.dataset.noteHeading ?? decodeFragment(href)
      const heading = [...target.querySelectorAll('h1,h2,h3,h4,h5,h6')].find(
        (element) =>
          element.textContent.trim().toLowerCase() === fragment.toLowerCase(),
      )
      const destination =
        ids.get(target)?.get(fragment) ?? heading?.id ?? target.id
      link.setAttribute('href', `#${destination}`)
      link.removeAttribute('target')
    }
  }
}

function decodeFragment(href: string) {
  const fragment = href.includes('#') ? href.slice(href.indexOf('#') + 1) : ''
  try {
    return decodeURIComponent(fragment)
  } catch {
    return fragment
  }
}
