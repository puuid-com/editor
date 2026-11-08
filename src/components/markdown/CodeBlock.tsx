import { useRef } from 'react'
import type { ComponentProps } from 'react'

import { copyText } from '#/components/app/clipboard'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

type PreProps = ComponentProps<'pre'> & {
  'data-lang'?: string
  'data-code-title'?: string
}

/**
 * A fenced code block framed with a header that names its language, or its
 * title when the fence gives one, beside a button that copies the code.
 */
export function CodeBlock({ className, children, ...props }: PreProps) {
  const ref = useRef<HTMLPreElement>(null)
  const lang = props['data-lang']
  const label =
    props['data-code-title'] ?? (lang && lang !== 'plaintext' ? lang : 'text')

  return (
    <div className="not-prose my-5 overflow-hidden rounded-md border bg-background">
      <div className="flex h-9 items-center justify-between gap-2 border-b pr-1.5 pl-3">
        <span className="truncate font-mono text-xs text-muted-foreground">
          {label}
        </span>
        <Button
          variant="outline"
          size="xs"
          onClick={() => void copyText(ref.current?.textContent ?? '')}
        >
          {m.md_code_copy()}
        </Button>
      </div>
      <pre
        ref={ref}
        {...props}
        className={cn(
          className,
          'overflow-x-auto px-3 py-2.5 font-mono text-foreground',
        )}
      >
        {children}
      </pre>
    </div>
  )
}
