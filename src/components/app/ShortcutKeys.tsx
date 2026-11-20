import { Kbd, KbdGroup } from '#/components/ui/kbd'
import { shortcutKeys } from '#/lib/shortcuts'
import type { Shortcut } from '#/lib/shortcuts'

/** A shortcut drawn as one key cap per key, in the platform's order. */
export function ShortcutKeys({
  shortcut,
  className,
}: {
  shortcut: Shortcut
  className?: string
}) {
  return (
    <KbdGroup className={className}>
      {shortcutKeys(shortcut).map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </KbdGroup>
  )
}
