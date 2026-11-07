import { ShortcutKeys } from './ShortcutKeys'
import { Button } from '#/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import type { Shortcut } from '#/lib/shortcuts'
import { cn } from '#/lib/utils'

/** Icon button; a shortcut or hint shows it in a tooltip with the label. */
export function ToolbarButton({
  label,
  shortcut,
  hint,
  size = 'icon-xs',
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'aria-label'> & {
  label: string
  shortcut?: Shortcut
  /** Short explanation shown under the label in the tooltip. */
  hint?: string
}) {
  const button = (
    <Button
      variant="ghost"
      size={size}
      aria-label={label}
      className={cn('max-md:size-11', className)}
      {...props}
    />
  )
  if (!shortcut && !hint) return button
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent className="flex max-w-64 flex-col items-start gap-0.5">
        <span className="flex items-center gap-2">
          {label}
          {shortcut && <ShortcutKeys shortcut={shortcut} />}
        </span>
        {hint && <span className="text-background/70">{hint}</span>}
      </TooltipContent>
    </Tooltip>
  )
}
