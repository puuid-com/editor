const formatters = new Map<string, Intl.DateTimeFormat>()

/** One formatter per locale and kind, since building one is slow. */
function formatter(
  locale: string,
  kind: string,
  options: Intl.DateTimeFormatOptions,
) {
  const key = `${locale}|${kind}`
  let format = formatters.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options)
    formatters.set(key, format)
  }
  return format
}

/** Workspace timestamps, formatted in the app locale and browser time zone. */
export function formatDateTime(date: number | string, locale: string) {
  return formatter(locale, 'datetime', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

/** A calendar day such as `2026-11-02`, the same in every time zone. */
export function formatDay(day: string, locale: string) {
  return formatter(locale, 'day', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`))
}
