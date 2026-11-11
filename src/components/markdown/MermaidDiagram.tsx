import { useState } from 'react'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { diagramQuery } from './mermaid'
import { useDarkMode } from '#/hooks/use-dark-mode'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

/** Waits for typing to pause, so a half-written diagram isn't drawn. */
const DRAW_DELAY_MS = 250

/**
 * A ```mermaid block drawn as a diagram. Until the first drawing is ready it
 * shows its source; after that, a broken edit keeps the last good drawing,
 * faded, above the error.
 */
export function MermaidDiagram({ code }: { code: string }) {
  const dark = useDarkMode()
  const [debounced] = useDebouncedValue(code, { wait: DRAW_DELAY_MS })
  const query = useQuery({
    ...diagramQuery(debounced, dark),
    placeholderData: keepPreviousData,
  })
  const [lastGood, setLastGood] = useState(query.data)
  if (query.data && query.data !== lastGood) setLastGood(query.data)
  const svg = query.data ?? lastGood

  return (
    <figure
      data-mermaid
      data-pdf-state={
        query.isError ? 'error' : svg && !query.isFetching ? 'ready' : 'pending'
      }
      className="not-prose my-5 grid gap-2"
    >
      {svg ? (
        <div
          role="img"
          aria-label={m.md_diagram()}
          className={cn(
            'flex justify-start overflow-x-auto rounded-lg border bg-background p-4 [&_svg]:h-auto [&_svg]:max-w-full',
            query.isError && 'opacity-40',
          )}
          // Mermaid's strict mode sanitizes labels before they reach the SVG.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-5 text-muted-foreground">
          {code}
        </pre>
      )}
      {query.isError && (
        <figcaption className="font-mono text-xs text-destructive">
          {m.md_diagram_error({ message: errorMessage(query.error) })}
        </figcaption>
      )}
    </figure>
  )
}

function errorMessage(error: unknown) {
  const text = error instanceof Error ? error.message : String(error)
  // Mermaid's parse errors go on to quote the line; the first one is enough.
  return text.split('\n')[0].replace(/:$/, '')
}
