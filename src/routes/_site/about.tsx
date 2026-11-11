import { IconArrowRight } from '@tabler/icons-react'
import { Link, createFileRoute } from '@tanstack/react-router'

import { FeatureBento } from '#/components/showcase/FeatureBento'
import { Button } from '#/components/ui/button'
import { seo } from '#/lib/seo'
import { appVersion } from '#/lib/version'
import { m } from '#/paraglide/messages'
import { site } from '#/site'

export const Route = createFileRoute('/_site/about')({
  head: () =>
    seo({
      title: m.about_title(),
      description: m.seo_about_description(),
      path: '/about',
    }),
  component: About,
})

const linkClass =
  'underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

function About() {
  const facts = [
    {
      label: m.about_version(),
      value: (
        <Link to="/changelog" className={`font-mono ${linkClass}`}>
          {m.app_version({ version: appVersion })}
        </Link>
      ),
    },
    { label: m.about_storage(), value: m.about_storage_value() },
    {
      label: m.about_source(),
      value: (
        <a href={site.repository} className={linkClass}>
          {site.repository.replace(/^https:\/\//, '')}
        </a>
      ),
    },
  ]

  return (
    <section className="mx-auto max-w-5xl px-4 py-14 md:py-24">
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tighter text-balance md:text-6xl">
        {m.about_headline()}
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-pretty text-muted-foreground md:text-lg md:leading-8">
        {m.about_body()}
      </p>
      <div className="mt-8 flex flex-wrap gap-2">
        <Button asChild size="lg" className="h-10 px-4 text-sm">
          <Link to="/">
            {m.site_open_editor()}
            <IconArrowRight data-icon="inline-end" />
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="h-10 px-4 text-sm"
        >
          <a href={site.repository}>{m.about_source()}</a>
        </Button>
      </div>
      <FeatureBento className="mt-14 md:mt-20" />
      <dl className="mt-14 max-w-3xl border-t text-sm">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="grid gap-1 border-b py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-8"
          >
            <dt className="text-muted-foreground">{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
