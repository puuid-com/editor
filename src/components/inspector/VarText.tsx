import { Highlighted } from './SearchHighlight'
import { useFileVars } from '#/hooks/use-profiles'
import { cn } from '#/lib/utils'
import { splitVars } from '#/lib/xml/vars'

/** Parts with where each starts in the text, which keys them. */
function withOffsets<T extends { value: string }>(parts: Array<T>) {
  let at = 0
  return parts.map((part) => {
    const from = at
    at += part.value.length
    return { ...part, from }
  })
}

/**
 * Renders text with `<<var>>` placeholders as chips and search hits marked.
 * In a file whose variables are off, the text shows as written.
 */
export function VarText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const vars = useFileVars()
  const parts = vars
    ? splitVars(text)
    : [{ kind: 'text' as const, value: text }]
  const placed = withOffsets(parts)
  return (
    <span className={cn('truncate', className)}>
      {placed.map((part) =>
        part.kind === 'var' ? (
          <span key={part.from} className="var-chip">
            <Highlighted text={part.value} />
          </span>
        ) : (
          <span key={part.from}>
            <Highlighted text={part.value} />
          </span>
        ),
      )}
    </span>
  )
}
