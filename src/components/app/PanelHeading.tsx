import { cn } from '#/lib/utils'

/** Quiet heading over a side panel section. */
export function PanelHeading({
  className,
  ...props
}: React.ComponentProps<'h2'>) {
  return (
    <h2
      className={cn(
        'flex h-9 shrink-0 items-center gap-1.5 border-b px-3 text-xs font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}
