import { IconChevronDown } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'

import changelog from '../../../CHANGELOG.md?raw'
import { previews } from '#/components/changelog/previews'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import { parseChangelog } from '#/lib/changelog'
import { formatDay } from '#/lib/dates'
import type { ChangelogEntry } from '#/lib/changelog'
import { seo } from '#/lib/seo'
import { cn } from '#/lib/utils'
import { appVersion } from '#/lib/version'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'

const entries = parseChangelog(changelog)

export const Route = createFileRoute('/_site/changelog')({
  head: () =>
    seo({
      title: m.changelog_title(),
      description: m.seo_changelog_description(),
      path: '/changelog',
    }),
  component: Changelog,
})

// Section headings read as small mono labels, inline code as muted chips
// without typography's literal backticks, and commit links as muted hashes,
// so the bullets carry the page.
const bodyClass =
  'prose prose-sm max-w-none break-words prose-neutral dark:prose-invert prose-h3:mt-6 prose-h3:mb-2 prose-h3:font-mono prose-h3:text-[0.6875rem] prose-h3:font-medium prose-h3:uppercase prose-h3:tracking-wider prose-h3:text-muted-foreground prose-p:my-2 prose-p:text-muted-foreground prose-ul:my-2 prose-ul:pl-4 prose-li:my-1 prose-li:text-foreground prose-li:marker:text-muted-foreground prose-a:font-mono prose-a:text-xs prose-a:font-normal prose-a:text-muted-foreground prose-a:no-underline hover:prose-a:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.8125rem] prose-code:font-normal prose-code:break-all prose-code:before:content-none prose-code:after:content-none [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-2 [&_a:focus-visible]:outline-ring [&>:first-child]:mt-0'

/** Release notes; long ones show their first bullets and fold the rest. */
function Notes({ html, more }: Pick<ChangelogEntry, 'html' | 'more'>) {
  if (!more)
    return (
      <div className={bodyClass} dangerouslySetInnerHTML={{ __html: html }} />
    )
  // The fold can cut a list in two: the halves meet with the usual gap
  // between bullets, and a section heading after the fold keeps its space.
  return (
    <Collapsible className="group/notes">
      <div
        className={cn(bodyClass, '[&>ul:last-child]:mb-0')}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {/* Mounted while closed so the full notes stay in the server HTML. */}
      <CollapsibleContent forceMount className="data-[state=closed]:hidden">
        <div
          className={cn(bodyClass, '[&>h3:first-child]:mt-6')}
          dangerouslySetInnerHTML={{ __html: more.html }}
        />
      </CollapsibleContent>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="mt-4">
          <span className="group-data-[state=open]/notes:hidden">
            {m.changelog_show_all({ count: more.count })}
          </span>
          <span className="group-data-[state=closed]/notes:hidden">
            {m.changelog_show_fewer()}
          </span>
          <IconChevronDown
            data-icon="inline-end"
            className="group-data-[state=open]/notes:rotate-180"
          />
        </Button>
      </CollapsibleTrigger>
    </Collapsible>
  )
}

function Changelog() {
  const locale = getLocale()

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <header className="pb-10">
        <h1 className="text-3xl font-semibold tracking-tight">
          {m.changelog_title()}
        </h1>
        <p className="mt-3 max-w-prose text-sm leading-6 text-muted-foreground">
          {m.changelog_description()}
        </p>
      </header>
      {entries.map((entry) => {
        const Preview = previews[entry.id] as
          (typeof previews)[string] | undefined
        return (
          <article
            key={entry.id}
            id={entry.id}
            aria-labelledby={`title-${entry.id}`}
            className="grid scroll-mt-8 gap-4 border-t py-8 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-8"
          >
            <div className="md:sticky md:top-6 md:self-start">
              <h2
                id={`title-${entry.id}`}
                className="font-mono text-sm font-semibold"
              >
                <a href={`#${entry.id}`} className="hover:underline">
                  v{entry.id}
                </a>
              </h2>
              <time
                dateTime={entry.date}
                className="mt-1 block text-xs text-muted-foreground"
              >
                {formatDay(entry.date, locale)}
              </time>
              {entry.id === appVersion && (
                <Badge variant="outline" className="mt-2">
                  {m.changelog_latest()}
                </Badge>
              )}
            </div>
            <div className="min-w-0">
              <Notes html={entry.html} more={entry.more} />
              {Preview && <Preview />}
            </div>
          </article>
        )
      })}
    </section>
  )
}
