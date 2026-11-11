import { Link } from '@tanstack/react-router'

import { Logo } from '#/components/Logo'
import { LocaleSwitcher } from '#/components/LocaleSwitcher'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'
import { site } from '#/site'

const navItems = [
  { to: '/about', label: () => m.nav_about() },
  { to: '/changelog', label: () => m.nav_changelog() },
] as const

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-md text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo />
          {site.name}
        </Link>
        <nav className="flex flex-1 items-center gap-1 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              activeProps={{
                className: 'text-foreground',
                'aria-current': 'page',
              }}
              activeOptions={{ exact: true }}
            >
              {item.label()}
            </Link>
          ))}
        </nav>
        <LocaleSwitcher className="max-sm:hidden" />
        <Button asChild size="sm" className="px-3">
          <Link to="/">{m.site_open_editor()}</Link>
        </Button>
      </div>
    </header>
  )
}
