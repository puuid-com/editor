import { IconFilePlus, IconFolderOpen, IconJson } from '@tabler/icons-react'

import { newFile, newJsonFile } from './files'
import { Button } from '#/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { Kbd } from '#/components/ui/kbd'
import { shortcutLabel, shortcuts } from '#/lib/shortcuts'
import { m } from '#/paraglide/messages'

// One fragment per line, so the elements in a line need no keys.
const welcomeLines: Array<React.ReactNode> = [
  <>
    <T k="tag">{'<invoice'}</T> <T k="attr">id</T>
    <T k="punct">=</T>
    <T k="value">"2041"</T>
    <T k="tag">{'>'}</T>
  </>,
  <>
    {'  '}
    <T k="leaf">{'<customer>'}</T>
    <span className="var-chip">{'<<name>>'}</span>
    <T k="leaf">{'</customer>'}</T>
  </>,
  <>
    {'  '}
    <T k="leaf">{'<total'}</T> <T k="attr">currency</T>
    <T k="punct">=</T>
    <T k="value">"CAD"</T>
    <T k="leaf">{'>'}</T>
    <T k="value">128.00</T>
    <T k="leaf">{'</total>'}</T>
  </>,
  <>
    <T k="tag">{'</invoice>'}</T>
    <span className="welcome-caret" />
  </>,
]

function T({
  k,
  children,
}: {
  k: 'tag' | 'leaf' | 'attr' | 'punct' | 'value'
  children: React.ReactNode
}) {
  return <span style={{ color: `var(--syntax-${k})` }}>{children}</span>
}

function WelcomeSnippet() {
  return (
    <div aria-hidden="true" className="relative -my-4 px-12 py-10">
      <div className="welcome-grid absolute inset-0" />
      <pre className="relative border bg-background py-3 pr-6 text-left font-mono text-xs leading-6 shadow-xs">
        {welcomeLines.map((line, i) => (
          <div
            key={i}
            className="welcome-line flex"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <span className="w-9 shrink-0 pr-3 text-right text-(--syntax-gutter) select-none">
              {i + 1}
            </span>
            <span className="whitespace-pre">{line}</span>
          </div>
        ))}
      </pre>
    </div>
  )
}

export function Welcome({ onOpenFromDisk }: { onOpenFromDisk: () => void }) {
  return (
    <Empty className="h-full gap-8 overflow-y-auto">
      <EmptyMedia className="mb-0">
        <WelcomeSnippet />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle className="text-xl font-semibold tracking-tight">
          {m.welcome_title()}
        </EmptyTitle>
        <EmptyDescription>{m.welcome_body()}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-none gap-4">
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={newFile}>
            <IconFilePlus />
            {m.file_new()}
          </Button>
          <Button variant="outline" onClick={newJsonFile}>
            <IconJson />
            {m.file_new_json()}
          </Button>
          <Button variant="outline" onClick={onOpenFromDisk}>
            <IconFolderOpen />
            {m.file_open_disk()}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {m.welcome_hint_prefix()}{' '}
          <Kbd>{shortcutLabel(shortcuts.palette)}</Kbd>{' '}
          {m.welcome_hint_suffix()}
        </p>
      </EmptyContent>
    </Empty>
  )
}
