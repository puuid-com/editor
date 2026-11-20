import { cn } from '#/lib/utils'

function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 w-fit min-w-5 shrink-0 items-center justify-center gap-1 rounded-[4px] border border-b-2 border-border bg-background px-1 font-sans text-[11px] leading-none font-medium tracking-normal text-muted-foreground select-none in-data-[slot=tooltip-content]:border-background/30 in-data-[slot=tooltip-content]:bg-transparent in-data-[slot=tooltip-content]:text-background [&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn('inline-flex shrink-0 items-center gap-0.5', className)}
      {...props}
    />
  )
}

export { Kbd, KbdGroup }
