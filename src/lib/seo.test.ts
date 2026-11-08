import { describe, expect, it } from 'vitest'

import { absoluteUrl, seo } from './seo'
import { site } from '#/site'

describe('seo', () => {
  it('uses the site name alone when no title is given', () => {
    expect(seo().meta).toContainEqual({ title: site.name })
  })

  it('appends the site name to page titles', () => {
    expect(seo({ title: 'About' }).meta).toContainEqual({
      title: `About | ${site.name}`,
    })
  })

  it('adds canonical and hreflang links for a path', () => {
    const { links } = seo({ path: '/about' })

    expect(links).toContainEqual({
      rel: 'canonical',
      href: `${site.url}/about`,
    })
    expect(links).toContainEqual({
      rel: 'alternate',
      hrefLang: 'fr',
      href: `${site.url}/fr/about`,
    })
    expect(links).toContainEqual({
      rel: 'alternate',
      hrefLang: 'x-default',
      href: `${site.url}/about`,
    })
  })

  it('marks pages noindex on request', () => {
    expect(seo({ noindex: true }).meta).toContainEqual({
      name: 'robots',
      content: 'noindex, nofollow',
    })
  })
})

describe('absoluteUrl', () => {
  it('prefixes non-base locales', () => {
    expect(absoluteUrl('/about', 'fr')).toBe(`${site.url}/fr/about`)
    expect(absoluteUrl('/about', 'en')).toBe(`${site.url}/about`)
  })
})

describe('public metadata', () => {
  it('includes an absolute social image and localized canonical alternatives', () => {
    const { meta, links } = seo({ title: 'About', path: '/about' })
    expect(meta).toContainEqual({ title: 'About | Editor' })
    expect(meta).toContainEqual({
      property: 'og:image',
      content: `${site.url}/og.png`,
    })
    expect(meta).toContainEqual({ property: 'og:image:width', content: '1200' })
    expect(meta).toContainEqual({ property: 'og:locale', content: 'en_CA' })
    expect(links).toContainEqual({
      rel: 'canonical',
      href: `${site.url}/about`,
    })
    expect(links).toContainEqual({
      rel: 'alternate',
      hrefLang: 'fr',
      href: `${site.url}/fr/about`,
    })
  })
  it('preserves page descriptions and explicit indexing controls', () => {
    const { meta } = seo({ description: 'Page description', noindex: true })
    expect(meta).toContainEqual({
      name: 'description',
      content: 'Page description',
    })
    expect(meta).toContainEqual({
      name: 'robots',
      content: 'noindex, nofollow',
    })
  })
})
