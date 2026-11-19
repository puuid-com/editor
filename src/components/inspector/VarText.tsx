import { Highlighted } from './SearchHighlight'
import { useFileVars } from '#/hooks/use-profiles'
import { cn } from '#/lib/utils'
import { splitVars } from '#/lib/xml/vars'

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
  return (
    <span className={cn('truncate', className)}>
      {parts.map((part, i) =>
        part.kind === 'var' ? (
          <span key={i} className="var-chip">
            <Highlighted text={part.value} />
          </span>
        ) : (
          <span key={i}>
            <Highlighted text={part.value} />
          </span>
        ),
      )}
    </span>
  )
}
