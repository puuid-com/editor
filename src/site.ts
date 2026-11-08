// Site-wide identity used by the SEO helper, sitemap, robots.txt and manifest.
interface Site {
  name: string
  url: string
  ogImage: string
  twitter: string
  repository: string
  themeColor: string
  sitemapPaths: ReadonlyArray<string>
}

export const site: Site = {
  name: 'Editor',
  /** Production origin, no trailing slash. Used for canonical and sitemap URLs. */
  url: 'https://editor.puuid.com',
  /** Default social preview image (1200x630), e.g. '/og.png'. Empty to omit. */
  ogImage: '/og.png',
  /** Twitter/X handle including the @, or empty. */
  twitter: '',
  /** Public source repository URL. */
  repository: 'https://github.com/puuid-com/editor',
  themeColor: '#0a0a0a',
  /** Unlocalized paths listed in sitemap.xml. Add new public pages here. */
  sitemapPaths: ['/', '/about', '/changelog'],
}
