import { Link } from '@tanstack/react-router'

import { LocaleSwitcher } from '#/components/LocaleSwitcher'
import { appVersion } from '#/lib/version'
import { m } from '#/paraglide/messages'
import { site } from '#/site'

const linkClass =
  'rounded-sm transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring'

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-6 text-sm text-muted-foreground">
        <span className="flex-1 whitespace-nowrap">
          {m.footer_rights({ year: new Date().getFullYear(), name: site.name })}
        </span>
        {/* Phones have no room for it in the header. */}
        <LocaleSwitcher className="sm:hidden" />
        <a href={site.repository} className={linkClass}>
          {m.about_source()}
        </a>
        <Link
          to="/changelog"
          aria-label={m.app_version_label({ version: appVersion })}
          className={`font-mono tabular-nums ${linkClass}`}
        >
          {m.app_version({ version: appVersion })}
        </Link>
      </div>
    </footer>
  )
}
