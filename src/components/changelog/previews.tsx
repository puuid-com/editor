import {
  IconAdjustmentsHorizontal,
  IconAlertTriangle,
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconBraces,
  IconBrowser,
  IconCheck,
  IconCopy,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconColumnsOff,
  IconDots,
  IconDownload,
  IconEyeEdit,
  IconFileCode,
  IconFileDots,
  IconFilePlus,
  IconFolder,
  IconFolderOpen,
  IconFolderPlus,
  IconFolderRoot,
  IconFolderUp,
  IconJson,
  IconLayoutColumns,
  IconLayoutSidebarRight,
  IconMarkdown,
  IconNotebook,
  IconPhoto,
  IconPin,
  IconPlus,
  IconReplace,
  IconSelector,
  IconShare,
  IconTag,
  IconTextWrap,
  IconUpload,
  IconUserCircle,
  IconVariable,
  IconWand,
} from '@tabler/icons-react'
import { Fragment } from 'react'
import type { CSSProperties, ComponentType, ReactNode } from 'react'

import {
  Bar,
  BeforeAfter,
  Chip,
  Code,
  Figure,
  NewTab,
  SheetTab,
  SheetTabs,
  Shot,
  StatusBar,
  Syn,
  Tab,
  Tabs,
  sql,
} from './kit'
import { Logo } from '#/components/Logo'
import { colorLabel } from '#/components/highlights/color-label'
import { codeColorStyle } from '#/components/markdown/code-colors'
import { CodeColorPicker } from '#/components/markdown/CodeColorPicker'
import { site } from '#/site'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Kbd } from '#/components/ui/kbd'
import { Switch } from '#/components/ui/switch'
import { CODE_FONT_PROPERTY, codeFonts } from '#/lib/code-font'
import { LANGUAGE_EXTENSIONS } from '#/lib/document'
import { HIGHLIGHT_PRESETS, highlightCss } from '#/lib/store/colors'
import type { HighlightPreset } from '#/lib/store/colors'
import { shortcutLabel, shortcuts } from '#/lib/shortcuts'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

// One picture per release, keyed by its version in CHANGELOG.md. Releases
// that only touched tooling or docs have none.

const BLUE = 'var(--hl-blue)'
const PURPLE = 'var(--hl-purple)'
const TEAL = 'var(--hl-teal)'
const AMBER = 'var(--hl-amber)'
const GREEN = 'var(--hl-green)'
const ink = (color: string) => `oklch(from ${color} var(--hl-ink-l) c h)`

const QUERY = `-- open orders
SELECT o.id
\t, upper(u.name)
FROM orders AS o
JOIN users AS u ON u.id = o.uid
WHERE o.status = 'open'
\tAND o.total > 100`

const ORDER = [
  '<order id="4821">',
  '  <customer>Maya Chen</customer>',
  '  <status>shipped</status>',
  '  <total currency="CAD">128.00</total>',
  '</order>',
]

function SqlColours() {
  return (
    <BeforeAfter
      before={
        <div className="syntax-greyscale">
          <Code lines={sql(QUERY, 'grey')} />
        </div>
      }
      after={<Code lines={sql(QUERY, 'roles')} />}
    />
  )
}

function SqlFormat() {
  const oneLine = QUERY.split('\n').slice(1).join(' ').replace(/\t/g, '')
  return (
    <BeforeAfter
      before={
        <>
          <Tabs>
            <Tab name="query.sql" active />
          </Tabs>
          <Code lines={[oneLine.toLowerCase()]} format={(l) => l} wrap />
        </>
      }
      after={
        <>
          <Tabs>
            <Tab name="query.sql" active />
          </Tabs>
          <Code lines={sql(QUERY.split('\n').slice(1).join('\n'), 'grey')} />
        </>
      }
    />
  )
}

/** The five feature tiles, as a ruled grid of their titles. */
function MiniBento({ className }: { className?: string }) {
  const tiles = [
    m.showcase_sync_title(),
    m.showcase_local_value(),
    m.showcase_compare_title(),
    m.showcase_highlights_title(),
    m.showcase_share_title(),
  ]
  return (
    <div
      className={cn(
        'grid grid-cols-3 gap-px border bg-border text-[10px] leading-4',
        className,
      )}
    >
      {tiles.map((title, i) => (
        <div
          key={title}
          className={cn('grid content-start gap-2 bg-background p-2 pb-3', {
            'col-span-2': i === 0,
          })}
        >
          <span className="font-medium">{title}</span>
          <Bar className="w-3/5" />
        </div>
      ))}
    </div>
  )
}

function AboutPage({ grid }: { grid?: boolean }) {
  return (
    <div className="grid gap-3 p-4">
      <span className="text-sm font-semibold">{m.about_title()}</span>
      <div className="grid gap-1.5">
        <Bar className="w-11/12" />
        <Bar className="w-3/4" />
      </div>
      {grid && <MiniBento />}
      <div className="grid grid-cols-[4rem_1fr] gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span>{m.about_version()}</span>
        <span className="font-mono text-foreground">0.160.0</span>
        <span>{m.about_storage()}</span>
        <span className="text-foreground">{m.about_storage_value()}</span>
      </div>
    </div>
  )
}

function AboutGrid() {
  return <BeforeAfter before={<AboutPage />} after={<AboutPage grid />} />
}

function Showcase() {
  return (
    <Shot className="p-4">
      <MiniBento className="text-xs leading-5 [&>div]:min-h-16" />
    </Shot>
  )
}

function MenuItem({
  children,
  checked,
  disabled,
  sub,
}: {
  children: ReactNode
  checked?: boolean
  disabled?: boolean
  sub?: boolean
}) {
  return (
    <div
      className={cn(
        'flex h-7 items-center gap-2 px-2',
        disabled && 'opacity-50',
        sub && 'bg-muted',
      )}
    >
      <span className="w-3.5">
        {checked && <IconCheck className="size-3.5" />}
      </span>
      <span className="flex-1">{children}</span>
      {sub && <IconChevronRight className="size-3.5 text-muted-foreground" />}
    </div>
  )
}

function ChangeType() {
  return (
    <Shot>
      <Tabs>
        <Tab name="orders.xml" active />
        <Tab name="rates.json" />
      </Tabs>
      <div className="relative h-36">
        <Code lines={ORDER} className="opacity-40" />
        <div className="absolute top-1 left-6 flex items-start">
          <div className="w-44 border bg-popover py-1 shadow-md">
            <MenuItem>{m.file_rename()}</MenuItem>
            <MenuItem sub>{m.file_change_type()}</MenuItem>
            <MenuItem>{m.tabs_close()}</MenuItem>
          </div>
          <div className="mt-8 -ml-1 w-36 border bg-popover py-1 shadow-md">
            <MenuItem checked>{m.paste_type_xml()}</MenuItem>
            <MenuItem disabled>{m.paste_type_json()}</MenuItem>
            <MenuItem>{m.paste_type_flat()}</MenuItem>
          </div>
        </div>
      </div>
    </Shot>
  )
}

function ChangeTypeEmpty() {
  return (
    <Shot>
      <Tabs>
        <Tab name="untitled" active />
      </Tabs>
      <div className="relative h-32">
        <div className="absolute top-1 left-6 flex items-start">
          <div className="w-44 border bg-popover py-1 shadow-md">
            <MenuItem>{m.file_rename()}</MenuItem>
            <MenuItem sub>{m.file_change_type()}</MenuItem>
            <MenuItem>{m.tabs_close()}</MenuItem>
          </div>
          <div className="mt-8 -ml-1 w-36 border bg-popover py-1 shadow-md">
            <MenuItem>{m.paste_type_xml()}</MenuItem>
            <MenuItem checked>{m.paste_type_json()}</MenuItem>
            <MenuItem>{m.paste_type_flat()}</MenuItem>
            <MenuItem>{m.paste_type_sql()}</MenuItem>
          </div>
        </div>
      </div>
    </Shot>
  )
}

const TEMPLATE = ['<?xml version="1.0" encoding="UTF-8"?>', '<root>', '</root>']

function PasteTemplate() {
  return (
    <BeforeAfter
      before={
        <Code
          lines={[
            TEMPLATE[0],
            TEMPLATE[1],
            ...ORDER.slice(0, 2),
            '  …',
            TEMPLATE[2],
          ]}
          marks={{ 2: 'add', 3: 'add', 4: 'add' }}
        />
      }
      after={
        <Code
          lines={[...ORDER.slice(0, 2), '  …']}
          marks={{ 0: 'add', 1: 'add', 2: 'add' }}
        />
      }
    />
  )
}

function Option({
  children,
  selected,
  badge,
}: {
  children: ReactNode
  selected?: boolean
  badge?: string
}) {
  return (
    <div
      className={cn(
        'flex h-7 items-center gap-2 border px-2',
        selected ? 'border-foreground' : 'text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'size-3 rounded-full border',
          selected && 'border-4 border-foreground',
        )}
      />
      <span className="flex-1">{children}</span>
      {badge && (
        <Badge variant="secondary" className="h-4 px-1 text-[10px]">
          {badge}
        </Badge>
      )}
    </div>
  )
}

function PasteDialog() {
  return (
    <Shot className="bg-muted/40 p-6">
      <div className="mx-auto grid max-w-xs gap-3 border bg-background p-4 shadow-md">
        <div className="grid gap-1">
          <span className="text-sm font-semibold">{m.paste_title()}</span>
          <span className="text-muted-foreground">
            {m.paste_description({ name: m.file_untitled() })}
          </span>
        </div>
        <div className="grid gap-1.5">
          <span className="font-medium">{m.paste_type()}</span>
          <Option selected badge={m.paste_detected()}>
            {m.paste_type_xml()}
          </Option>
          <Option>{m.paste_type_json()}</Option>
        </div>
        <div className="grid gap-1.5">
          <span className="font-medium">{m.paste_profile()}</span>
          <Option selected badge={m.paste_best_match()}>
            {m.profile_default_name()}
          </Option>
        </div>
        <Button size="sm" className="justify-self-end">
          {m.paste_open({ type: m.paste_type_xml() })}
          <Kbd className="bg-primary-foreground/15 text-primary-foreground">
            ↵
          </Kbd>
        </Button>
      </div>
    </Shot>
  )
}

const PASTED_JSON = ['{', '  "order": 4821,', '  "currency": "CAD"', '}']

/** The status bar's type picker: Auto, then each type's extension. */
const DRAFT_TYPES = [
  m.draft_type_auto(),
  ...(['xml', 'json', 'sql', 'zpl', 'md', 'txt'] as const).map((language) =>
    LANGUAGE_EXTENSIONS[language][0].slice(1).toUpperCase(),
  ),
]

function DraftEditor() {
  return (
    <BeforeAfter
      className="flex h-52 flex-col"
      before={
        <div className="grid flex-1 content-center justify-items-center gap-3 px-3 text-center">
          <div className="relative px-6 py-3">
            <div className="welcome-grid absolute inset-0" />
            <Code
              className="relative border bg-background pr-3 text-left shadow-xs"
              lines={[
                '<invoice id="2041">',
                '  <total>128.00</total>',
                '</invoice>',
              ]}
            />
          </div>
          <span className="text-sm font-semibold tracking-tight">
            {m.welcome_title()}
          </span>
          <div className="flex flex-wrap justify-center gap-1">
            <Button size="xs">
              <IconFilePlus />
              {m.file_new()}
            </Button>
            <Button size="xs" variant="outline">
              {m.file_new_zpl()}
            </Button>
            <Button size="xs" variant="outline">
              <IconJson />
              {m.file_new_json()}
            </Button>
            <Button size="xs" variant="outline">
              <IconFolderOpen />
              {m.file_open_disk()}
            </Button>
          </div>
        </div>
      }
      after={
        <>
          <SheetTabs>
            <div className="flex h-full items-center rounded-t-md border border-b-0 border-border bg-background px-2">
              {m.file_untitled()}
            </div>
          </SheetTabs>
          <Code
            wrap
            className="flex-1"
            marks={{ 0: 'active' }}
            lines={[
              <span key="draft" className="text-muted-foreground">
                {m.draft_placeholder()}
                <br />
                <span className="opacity-60">
                  {m.draft_hint({ shortcut: shortcutLabel(shortcuts.palette) })}
                </span>
              </span>,
            ]}
          />
          <StatusBar>
            <span className="flex shrink-0 border font-mono text-[10px]">
              {DRAFT_TYPES.map((type, i) => (
                <span
                  key={type}
                  className={cn(
                    'border-l px-1 first:border-l-0',
                    i === 0 && 'bg-foreground text-background',
                  )}
                >
                  {type}
                </span>
              ))}
            </span>
            <span className="ml-1.5 flex min-w-0 items-center gap-1 text-foreground">
              <IconFolderOpen className="size-3.5 shrink-0" />
              <span className="truncate">{m.file_open_disk()}</span>
            </span>
          </StatusBar>
        </>
      }
    />
  )
}

function PasteBar() {
  const xml = m.paste_type_xml()
  const json = m.paste_type_json()
  return (
    <BeforeAfter
      className="flex flex-col"
      before={
        <>
          <Tabs>
            <Tab name="orders.xml" active />
          </Tabs>
          <div className="relative h-32">
            <Code lines={PASTED_JSON} className="opacity-30" />
            <div className="absolute inset-x-4 top-3 grid gap-1.5 border bg-popover p-2 shadow-md">
              <span className="font-semibold">{m.paste_title()}</span>
              <Option selected badge={m.paste_detected()}>
                {json}
              </Option>
              <Option>{xml}</Option>
            </div>
          </div>
        </>
      }
      after={
        <>
          <Tabs>
            <Tab name="orders.xml" active />
          </Tabs>
          <div className="flex flex-wrap items-center gap-1.5 border-b bg-muted px-2 py-1">
            <span className="min-w-0 flex-1">
              {m.paste_mismatch({ detected: json, current: xml })}
            </span>
            <Button size="xs" variant="ghost" className="text-muted-foreground">
              {m.paste_keep({ type: xml })}
            </Button>
            <Button size="xs">{m.paste_switch({ type: json })}</Button>
          </div>
          <div className="h-[6.5rem]">
            <Code lines={PASTED_JSON} />
          </div>
        </>
      }
    />
  )
}

function EmptyFile() {
  return (
    <BeforeAfter
      className="flex flex-col"
      before={
        <>
          <Tabs>
            <Tab name={m.file_untitled_json()} active />
          </Tabs>
          <Code
            lines={['{', '  ', '}']}
            format={(line) => <Syn k="punct">{line}</Syn>}
          />
        </>
      }
      after={
        <>
          <Tabs>
            <Tab name={m.file_untitled()} active />
          </Tabs>
          <div className="flex flex-1 items-center justify-center p-6 text-muted-foreground">
            <IconFileDots className="mr-2 size-4" />
            {m.editor_placeholder()}
          </div>
        </>
      }
    />
  )
}

const FLAT = [
  'SH|4821|2026-10-30|CAD',
  'PC|1|A-102|2.40',
  'PC|2|B-317|0.80',
  'PC|3|C-040|1.15',
]

function flat(line: string) {
  return line.split('|').map((field, i) => (
    <span key={i}>
      {i > 0 && <Syn k="punct">|</Syn>}
      <Syn k={i === 0 ? 'tag' : 'value'}>{field}</Syn>
    </span>
  ))
}

function FlatFiles() {
  return (
    <Shot className="grid sm:grid-cols-[1fr_1fr]">
      <Code lines={FLAT} format={flat} marks={{ 2: 'active' }} />
      <FlatRecordsPanel className="border-t sm:border-t-0 sm:border-l" />
    </Shot>
  )
}

function FlatRecordsPanel({
  className,
  pins,
  ruled,
}: {
  className?: string
  pins?: boolean
  ruled?: boolean
}) {
  const cellRule = ruled && 'border-r'
  const rows = FLAT.slice(1).map((line) => line.split('|').slice(1))
  return (
    <div className={cn('bg-muted/20', className)}>
      {pins && (
        <div className="flex h-8 items-center border-b px-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {m.pins_title()}
        </div>
      )}
      <div>
        <div className="flex h-8 items-center gap-3 border-b px-3 text-muted-foreground">
          <span>SH</span>
          <span className="flex h-full items-center border-b border-foreground text-foreground">
            PC
          </span>
        </div>
        <table className="w-full font-mono text-[11px]">
          <thead className="text-muted-foreground">
            <tr className="border-b">
              {['#', '1', '2', '3'].map((h) => (
                <th
                  key={h}
                  className={cn('px-3 py-1 text-left font-normal', cellRule)}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, r) => (
              <tr key={r} className={cn('border-b', r === 1 && 'bg-muted')}>
                <td className={cn('px-3 py-1 text-muted-foreground', cellRule)}>
                  {r + 2}
                </td>
                {cells.map((cell, c) => (
                  <td
                    key={c}
                    className={cn(
                      'px-3 py-1',
                      cellRule,
                      r === 1 &&
                        c === 1 &&
                        'outline outline-foreground -outline-offset-1',
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FlatRecordsRuled() {
  return (
    <BeforeAfter
      before={<FlatRecordsPanel />}
      after={<FlatRecordsPanel ruled />}
    />
  )
}

function FlatRecordsBelow() {
  return (
    <BeforeAfter
      before={
        <div className="grid grid-cols-[1fr_1fr]">
          <Code lines={FLAT} format={flat} marks={{ 2: 'active' }} />
          <FlatRecordsPanel className="border-l" pins />
        </div>
      }
      after={
        <>
          <Code lines={FLAT} format={flat} marks={{ 2: 'active' }} />
          <FlatRecordsPanel className="border-t" />
        </>
      }
    />
  )
}

function TabKey({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b px-3 py-2 text-muted-foreground">
      <Kbd>Tab</Kbd>
      <IconChevronRight className="size-3.5" />
      {children}
    </div>
  )
}

function TabCompletion() {
  return (
    <BeforeAfter
      before={
        <>
          <TabKey>⇥</TabKey>
          <Code
            lines={[
              '<order>',
              <span key="0">
                {'  <to>    '}
                <Syn k="value">{'<<us'}</Syn>
              </span>,
              '</order>',
            ]}
          />
        </>
      }
      after={
        <>
          <TabKey>{'<<user>>'}</TabKey>
          <Code lines={['<order>', '  <to><<user>></to>', '</order>']} />
        </>
      }
    />
  )
}

function AbsentHighlights() {
  return (
    <BeforeAfter
      before={
        <StatusBar className="border-t-0">
          <Chip name="order" color={BLUE} count={1} />
          <Chip name="sku" color={PURPLE} count={3} />
          <Chip name="carrier" color={TEAL} count={0} dim />
          <Chip name="tracking" color={AMBER} count={0} dim />
        </StatusBar>
      }
      after={
        <StatusBar className="border-t-0">
          <Chip name="order" color={BLUE} count={1} />
          <Chip name="sku" color={PURPLE} count={3} />
          <span className="px-1.5 underline decoration-dotted underline-offset-2">
            {m.highlights_absent({ count: 2 })}
          </span>
        </StatusBar>
      }
    />
  )
}

function Tooltip({ children }: { children: ReactNode }) {
  return (
    <div className="absolute bottom-full left-1/2 mb-1.5 flex -translate-x-1/2 items-center gap-1.5 bg-foreground px-2 py-1 text-[11px] whitespace-nowrap text-background">
      {children}
    </div>
  )
}

function Toolbar({ tooltip }: { tooltip: ReactNode }) {
  return (
    <div className="flex h-24 items-end justify-center gap-1 pb-3">
      <Button size="xs" variant="ghost">
        <IconLayoutSidebarRight />
      </Button>
      <div className="relative">
        <Tooltip>{tooltip}</Tooltip>
        <Button size="xs" variant="outline">
          <IconWand />
          {m.action_format()}
        </Button>
      </div>
      <Button size="xs" variant="ghost">
        <IconShare />
        {m.share_button()}
      </Button>
    </div>
  )
}

function Tooltips() {
  return (
    <BeforeAfter
      before={<Toolbar tooltip={m.action_format()} />}
      after={
        <Toolbar
          tooltip={
            <Kbd className="h-4 bg-background/20 text-background">
              {shortcutLabel(shortcuts.format)}
            </Kbd>
          }
        />
      }
    />
  )
}

function TabAlignment({ fixed }: { fixed?: boolean }) {
  return (
    <div className="relative">
      <span className="absolute inset-x-0 top-[calc(50%+2px)] border-t border-dashed border-(--hl-red)/60" />
      <div className="flex h-12 items-end gap-px bg-muted/60 px-3 pt-2 text-sm">
        <Tab name="orders.xml" active />
        <NewTab className={cn('size-8', !fixed && 'translate-y-[5px]')} />
      </div>
    </div>
  )
}

function Alignment() {
  return (
    <BeforeAfter before={<TabAlignment />} after={<TabAlignment fixed />} />
  )
}

function WelcomeButtons({ equal }: { equal?: boolean }) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      <Button size="xs" variant={equal ? 'outline' : 'default'}>
        <IconFilePlus />
        {m.file_new()}
      </Button>
      <Button size="xs" variant="outline">
        <IconJson />
        {m.file_new_json()}
      </Button>
      <Button size="xs" variant="outline">
        <IconFolderOpen />
        {m.file_open_disk()}
      </Button>
    </div>
  )
}

function Welcome({ children }: { children: ReactNode }) {
  return (
    <Shot>
      <div className="grid justify-items-center gap-4 px-4 py-8 text-center">
        {children}
      </div>
    </Shot>
  )
}

function WelcomeSnippet() {
  return (
    <Welcome>
      <div className="relative px-8 py-5">
        <div className="welcome-grid absolute inset-0" />
        <Code
          className="relative border bg-background pr-4 text-left shadow-xs"
          lines={[
            '<invoice id="2041">',
            '  <customer><<name>></customer>',
            '  <total currency="CAD">128.00</total>',
            '</invoice>',
          ]}
        />
      </div>
      <div className="grid gap-1">
        <span className="text-base font-semibold tracking-tight">
          {m.welcome_title()}
        </span>
        <span className="max-w-sm text-muted-foreground">
          {m.welcome_body()}
        </span>
      </div>
      <WelcomeButtons />
    </Welcome>
  )
}

function WelcomeRestored() {
  return (
    <Welcome>
      <div className="grid gap-1">
        <span className="text-base font-semibold tracking-tight">
          {m.welcome_title()}
        </span>
        <span className="max-w-sm text-muted-foreground">
          {m.welcome_body()}
        </span>
      </div>
      <WelcomeButtons equal />
      <span className="text-[11px] text-muted-foreground">
        {m.welcome_hint_prefix()} <Kbd>{shortcutLabel(shortcuts.palette)}</Kbd>{' '}
        {m.welcome_hint_suffix()}
      </span>
    </Welcome>
  )
}

function WelcomeSimple() {
  return (
    <Welcome>
      <div className="flex size-12 items-center justify-center border bg-muted/40">
        <IconBraces className="size-5 text-muted-foreground" />
      </div>
      <span className="text-base font-semibold tracking-tight">
        {m.welcome_title()}
      </span>
      <Button size="sm">
        <IconFolderOpen />
        {m.file_open_disk()}
      </Button>
      <div className="flex gap-3 text-muted-foreground">
        <span>{m.file_new()}</span>
        <span>{m.file_new_json()}</span>
      </div>
    </Welcome>
  )
}

function Release({
  version,
  date,
  bullets = 2,
}: {
  version: string
  date: string
  bullets?: number
}) {
  return (
    <div className="grid grid-cols-[5rem_1fr] gap-3 border-t px-3 py-2.5 first:border-t-0">
      <div className="grid content-start gap-0.5">
        <span className="font-mono font-semibold">v{version}</span>
        <span className="text-[10px] text-muted-foreground">{date}</span>
      </div>
      <div className="grid content-start gap-1.5 pt-1">
        {Array.from({ length: bullets }, (_, i) => (
          <Bar key={i} className={i % 2 ? 'w-2/3' : 'w-11/12'} />
        ))}
      </div>
    </div>
  )
}

function EarlierReleases() {
  return (
    <BeforeAfter
      before={
        <>
          <Release version="0.150.0" date="Oct 28" />
          <Release version="0.147.0" date="Oct 28" bullets={1} />
          <div className="flex items-center gap-2 border-t px-3 py-2.5 font-mono text-[10px] text-muted-foreground">
            <IconChevronRight className="size-3.5" />
            9a2b2ed · be49086 · 5714cde · … · c448ae4
          </div>
        </>
      }
      after={
        <>
          <Release version="0.147.0" date="Oct 28" bullets={1} />
          <Release version="0.146.0" date="Oct 28" bullets={1} />
          <Release version="0.127.0" date="Oct 27" bullets={1} />
          <Release version="0.98.0" date="Oct 26" bullets={1} />
        </>
      }
    />
  )
}

function ChangelogRows() {
  return (
    <Shot>
      <Release version="0.150.0" date="Oct 28" bullets={3} />
      <Release version="0.149.0" date="Oct 28" />
      <Release version="0.148.0" date="Oct 28" bullets={1} />
    </Shot>
  )
}

function ReleasePictures() {
  const thumb = (tone: string) => (
    <div className="grid gap-1 border p-1.5">
      <Bar className="w-3/4" />
      <span
        className="block h-1.5 w-1/2"
        style={{ backgroundColor: ink(tone) }}
      />
      <Bar className="w-2/3" />
    </div>
  )
  return (
    <BeforeAfter
      before={<Release version="0.162.0" date="Nov 1" />}
      after={
        <>
          <Release version="0.162.0" date="Nov 1" />
          <div className="grid grid-cols-2 gap-2 pr-3 pb-3 pl-[6.5rem]">
            {thumb('var(--hl-gray)')}
            {thumb(BLUE)}
          </div>
        </>
      }
    />
  )
}

function FoldedNotes() {
  return (
    <BeforeAfter
      before={<Release version="0.84.0" date="Oct 25" bullets={9} />}
      after={
        <>
          <Release version="0.84.0" date="Oct 25" bullets={3} />
          <div className="pb-3 pl-[6.5rem]">
            <Button size="xs" variant="outline">
              {m.changelog_show_all({ count: 43 })}
              <IconChevronDown />
            </Button>
          </div>
        </>
      }
    />
  )
}

function AutoProfile() {
  const strip = (color?: string) => (
    <Tabs>
      <Tab name="rates.json" />
      <Tab name="shipment.xml" active color={color} />
    </Tabs>
  )
  const bar = (name: string, color?: string) => (
    <StatusBar>
      <IconUserCircle className="size-3.5" />
      <span
        style={color ? ({ '--hl': color } as CSSProperties) : undefined}
        className={cn('px-1', color && 'hl-tag hl-ink')}
      >
        {name}
      </span>
    </StatusBar>
  )
  return (
    <BeforeAfter
      before={
        <>
          {strip()}
          <Code lines={['<shipment>', '  <carrier>UPS</carrier>']} />
          {bar(m.profile_default_name())}
        </>
      }
      after={
        <>
          {strip(TEAL)}
          <Code lines={['<shipment>', '  <carrier>UPS</carrier>']} />
          {bar('Shipping', TEAL)}
        </>
      }
    />
  )
}

function ChangelogLink() {
  return (
    <Shot className="grid sm:grid-cols-2">
      <div className="flex flex-col justify-end border-b sm:border-r sm:border-b-0">
        <Code lines={ORDER.slice(0, 3)} className="opacity-40" />
        <StatusBar>
          <IconUserCircle className="size-3.5" />
          <span>{m.profile_default_name()}</span>
          <div className="flex-1" />
          <span className="bg-muted px-1.5 font-mono text-foreground underline underline-offset-2">
            {m.app_version({ version: '0.148.0' })}
          </span>
        </StatusBar>
      </div>
      <div className="grid content-start">
        <span className="px-3 pt-3 pb-2 text-sm font-semibold">
          {m.changelog_title()}
        </span>
        <Release version="0.148.0" date="Oct 28" />
        <Release version="0.147.0" date="Oct 28" bullets={1} />
      </div>
    </Shot>
  )
}

function VersionInBar() {
  const bar = (version?: string) => (
    <StatusBar className="border-t-0">
      <span>{m.status_profile()}</span>
      <span className="text-foreground">{m.profile_default_name()}</span>
      <div className="flex-1" />
      {version && (
        <span className="px-1.5 font-mono tabular-nums">
          {m.app_version({ version })}
        </span>
      )}
      <span className="px-1.5 font-mono tabular-nums">3:12</span>
    </StatusBar>
  )
  return <BeforeAfter before={bar()} after={bar('0.147.0')} />
}

function LabelledSwitches() {
  const icons = [
    IconUserCircle,
    IconVariable,
    IconReplace,
    IconSelector,
    IconAdjustmentsHorizontal,
  ]
  return (
    <BeforeAfter
      before={
        <StatusBar className="border-t-0">
          {icons.map((Icon, i) => (
            <span key={i} className="flex size-6 items-center justify-center">
              <Icon className="size-3.5" />
            </span>
          ))}
        </StatusBar>
      }
      after={
        <StatusBar className="h-auto flex-wrap gap-x-3 gap-y-1.5 border-t-0 py-1.5">
          <span className="flex items-center gap-1 text-foreground">
            <IconUserCircle className="size-3.5 text-muted-foreground" />
            {m.profile_default_name()}
          </span>
          <span className="flex items-center gap-1.5">
            <Switch size="sm" checked />
            {'<<var>>'}
          </span>
          <span className="flex items-center gap-1">
            <IconReplace className="size-3.5" />
            {m.vars_resolve_short()}
          </span>
          <span className="flex items-center gap-1">
            <IconAdjustmentsHorizontal className="size-3.5" />
            {m.defaults_apply()}
          </span>
        </StatusBar>
      }
    />
  )
}

function BrowserTabs() {
  return (
    <BeforeAfter
      before={
        <div className="flex h-8 items-end gap-4 border-b px-3">
          <span className="flex h-full items-center border-b-2 border-foreground">
            orders.xml
          </span>
          <span className="flex h-full items-center text-muted-foreground">
            rates.json
          </span>
          <span className="flex h-full items-center text-muted-foreground">
            label.xml
          </span>
        </div>
      }
      after={
        <Tabs>
          <Tab name="orders.xml" active color={BLUE} />
          <Tab name="rates.json" color={GREEN} />
          <Tab name="label.xml" />
        </Tabs>
      }
    />
  )
}

// The syntax tokens are CSS variables, so the old colour palette is the
// same lines with those variables pointed at the highlight colours.
const colourful = {
  '--syntax-tag': ink(BLUE),
  '--syntax-attr': ink(AMBER),
  '--syntax-value': ink(GREEN),
} as CSSProperties

function GreyscaleSyntax() {
  return (
    <BeforeAfter
      before={
        <div style={colourful}>
          <Code lines={ORDER} />
        </div>
      }
      after={
        <div className="syntax-greyscale">
          <Code lines={ORDER} />
        </div>
      }
    />
  )
}

function SortOrder() {
  return (
    <BeforeAfter
      before={
        <Code
          lines={[
            '<order>',
            '  <total>128.00</total>',
            '  <status>shipped</status>',
            '  <id>4821</id>',
            '  <customer>Maya Chen</customer>',
            '</order>',
          ]}
        />
      }
      after={
        <Code
          lines={[
            '<order>',
            '  <id>4821</id>',
            '  <customer>Maya Chen</customer>',
            '  <status>shipped</status>',
            '  <total>128.00</total>',
            '</order>',
          ]}
          marks={{ 1: 'active', 2: 'active' }}
        />
      }
    />
  )
}

function CompareTabs() {
  const side = (status: string, mark: 'add' | 'remove') => (
    <Code
      lines={[
        ORDER[0],
        ORDER[1],
        `  <status>${status}</status>`,
        ORDER[3],
        ORDER[4],
      ]}
      marks={{ 2: mark }}
    />
  )
  return (
    <Shot>
      <div className="flex h-8 items-center gap-2 border-b px-3 text-muted-foreground">
        <span className="text-foreground">orders.xml</span>
        <span>↔</span>
        <span className="text-foreground">orders-v2.xml</span>
        <div className="flex-1" />
        <span>{m.compare_changes({ count: 1 })}</span>
      </div>
      <div className="grid grid-cols-2 divide-x">
        {side('pending', 'remove')}
        {side('shipped', 'add')}
      </div>
    </Shot>
  )
}

function FirstEditor() {
  const hl = { '--hl': BLUE } as CSSProperties
  const tree: Array<[number, string, boolean?]> = [
    [0, 'order'],
    [1, 'customer'],
    [1, 'status', true],
    [1, 'total'],
  ]
  return (
    <Shot className="grid grid-cols-[1fr_9rem]">
      <Code
        lines={[
          ORDER[0],
          ORDER[1],
          <span key="s">
            {'  '}
            <span style={hl} className="hl-tag hl-ink">
              {'<status>'}
            </span>
            <Syn k="value">shipped</Syn>
            <span style={hl} className="hl-tag hl-ink">
              {'</status>'}
            </span>
          </span>,
          ORDER[3],
          ORDER[4],
        ]}
        marks={{ 2: 'active' }}
      />
      <div className="border-l bg-muted/20 py-2 font-mono text-[11px] leading-5">
        <span className="block px-3 pb-1 font-sans text-[10px] text-muted-foreground uppercase">
          {m.panel_structure()}
        </span>
        {tree.map(([depth, name, active]) => (
          <div
            key={name}
            style={{ paddingLeft: `${0.75 + depth}rem` }}
            className={cn(active && 'bg-muted')}
          >
            {active ? (
              <span style={hl} className="hl-ink">
                {name}
              </span>
            ) : (
              name
            )}
          </div>
        ))}
      </div>
    </Shot>
  )
}

const PREFIXED: Array<[number, string, string?]> = [
  [0, 'inv:Invoice'],
  [1, 'inv:ID', '2041'],
  [1, 'inv:Status', 'paid'],
  [1, 'inv:Total', '128.00'],
]

function PrefixedTree({ pinned }: { pinned?: boolean }) {
  return (
    <div className="bg-muted/20 py-2 font-mono text-[11px] leading-5">
      <span className="block px-3 pb-1 font-sans text-[10px] text-muted-foreground uppercase">
        {m.panel_structure()}
      </span>
      {PREFIXED.map(([depth, name, value]) => (
        <div
          key={name}
          style={{ paddingLeft: `${0.75 + depth}rem` }}
          className="flex items-center gap-2 pr-3"
        >
          <span className="font-medium text-syntax-tag">{name}</span>
          {value && <span className="text-foreground/80">{value}</span>}
          {pinned && name === 'inv:ID' && (
            <IconPin className="ml-auto size-3 text-muted-foreground" />
          )}
        </div>
      ))}
    </div>
  )
}

function PrefixedPins() {
  return (
    <BeforeAfter before={<PrefixedTree />} after={<PrefixedTree pinned />} />
  )
}

function PinCopyName({ name }: { name?: boolean }) {
  const Icon = name ? IconTag : IconBraces
  return (
    <div className="flex items-center gap-2 bg-muted/20 px-3 py-3 font-mono text-[11px]">
      <span className="font-medium text-syntax-tag">SenderCode</span>
      <span className="flex h-6 min-w-0 flex-1 items-center gap-1 rounded-md border bg-background pr-1 pl-1.5">
        <span className="flex-1 truncate">ACME01</span>
        <IconCopy aria-hidden className="size-3 text-muted-foreground" />
        <span
          className={cn(
            'grid size-4 place-items-center rounded-sm text-muted-foreground',
            name && 'bg-muted text-foreground',
          )}
        >
          <Icon aria-hidden className="size-3" />
        </span>
      </span>
      {name && (
        <Badge variant="outline" className="font-sans">
          <IconCheck aria-hidden />
          {m.copied()}
        </Badge>
      )}
    </div>
  )
}

function PinCopyNames() {
  return <BeforeAfter before={<PinCopyName />} after={<PinCopyName name />} />
}

function PinTagChip({ inChip, start }: { inChip?: boolean; start?: boolean }) {
  const tagStyle = { '--hl': TEAL } as CSSProperties
  return (
    <div className="flex items-center gap-2 bg-muted/20 px-3 py-3 font-mono text-[11px]">
      <span className="hl-tag flex items-center font-medium" style={tagStyle}>
        {start && <IconTag aria-hidden className="hl-ink ml-1 size-3" />}
        <span className="hl-ink px-1">SenderCode</span>
        {inChip && !start && (
          <IconTag aria-hidden className="hl-ink mr-1 size-3" />
        )}
      </span>
      <span className="flex h-6 min-w-0 flex-1 items-center gap-1 rounded-md border bg-background pr-1 pl-1.5">
        <span className="flex-1 truncate">ACME01</span>
        <IconCopy aria-hidden className="size-3 text-muted-foreground" />
        {!inChip && (
          <IconTag aria-hidden className="size-3 text-muted-foreground" />
        )}
      </span>
    </div>
  )
}

function PinTagChips() {
  return <BeforeAfter before={<PinTagChip />} after={<PinTagChip inChip />} />
}

function PinTagChipStart() {
  return (
    <BeforeAfter
      before={<PinTagChip inChip />}
      after={<PinTagChip inChip start />}
    />
  )
}

function PinTagChipClick() {
  return (
    <Shot>
      <div className="flex items-center gap-2 bg-muted/20 px-3 py-3 font-mono text-[11px]">
        <span
          className="hl-tag hl-ink flex items-center gap-1 px-1 font-medium"
          style={{ '--hl': TEAL } as CSSProperties}
        >
          <IconTag aria-hidden className="size-3" />
          SenderCode
        </span>
        <Badge variant="outline" className="font-sans">
          <IconCheck aria-hidden />
          {m.copied()}
        </Badge>
      </div>
    </Shot>
  )
}

function PinOccurrence({ count }: { count?: boolean }) {
  const rows = [
    ['Line', 'Bolts'],
    ['Line[2]', 'Washers'],
    ['Line[3]', 'Nuts'],
  ]
  return (
    <div className="grid gap-2 bg-muted/20 px-3 py-3 font-mono text-[11px]">
      <div className="flex items-center gap-2">
        <span className="font-medium text-syntax-tag">Description</span>
        <span className="flex h-6 min-w-0 flex-1 items-center gap-1 rounded-md border bg-background pr-1 pl-1.5">
          <span className="flex-1 truncate">Washers</span>
          <span
            className={cn(
              'flex items-center gap-0.5 text-muted-foreground tabular-nums',
              count && 'bg-muted px-1 text-foreground',
            )}
          >
            {count ? '2/3' : '3'}
            {count && <IconSelector aria-hidden className="size-3" />}
          </span>
          <IconCopy aria-hidden className="size-3 text-muted-foreground" />
        </span>
      </div>
      {count && (
        <ol className="ml-auto w-48 border bg-popover p-1 shadow-md">
          {rows.map(([parent, value], i) => (
            <li
              key={parent}
              className={cn(
                'grid grid-cols-[1rem_minmax(0,1fr)] gap-x-2 px-1.5 py-1',
                i === 1 &&
                  'bg-accent/60 shadow-[inset_2px_0_var(--foreground)]',
              )}
            >
              <span className="text-right text-muted-foreground">{i + 1}</span>
              <span className="grid">
                <span className="truncate">{value}</span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {m.pin_match_parent({ parent })}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function PinOccurrences() {
  return (
    <BeforeAfter before={<PinOccurrence />} after={<PinOccurrence count />} />
  )
}

function PinOccurrenceRows() {
  const rows = [
    ['Line', 'Bolts'],
    ['Line[2]', 'Washers'],
    ['Line[3]', 'Nuts'],
  ]
  const field = (value: string, current?: boolean) => (
    <span
      className={cn(
        'flex h-6 min-w-0 items-center gap-1 rounded-md border bg-background pr-1 pl-1.5',
        current && 'shadow-[inset_2px_0_var(--foreground)]',
      )}
    >
      <span className="flex-1 truncate">{value}</span>
      <IconCopy aria-hidden className="size-3 text-muted-foreground" />
    </span>
  )
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 bg-muted/20 px-3 py-3 font-mono text-[11px]">
      <span className="font-medium text-syntax-tag">Description</span>
      <span className="px-1.5 font-sans text-muted-foreground">
        {m.pin_matches_count({ count: 3 })}
      </span>
      {rows.map(([parent, value], i) => (
        <Fragment key={parent}>
          <span className="flex justify-end gap-1.5 text-[10px] text-muted-foreground">
            <span>{parent}</span>
            <span>{i + 1}</span>
          </span>
          {field(value, i === 1)}
        </Fragment>
      ))}
    </div>
  )
}

function PinOccurrenceList() {
  return (
    <BeforeAfter
      before={<PinOccurrence count />}
      after={<PinOccurrenceRows />}
    />
  )
}

function PinOccurrenceRevert() {
  return (
    <BeforeAfter before={<PinOccurrenceRows />} after={<PinOccurrence />} />
  )
}

function PinOccurrenceTree({
  tag = 'Description',
  rows = [
    ['Line[1]', 'Bolts'],
    ['Line[2]', 'Washers'],
    ['Line[3]', 'Nuts'],
  ],
  goTo,
}: {
  tag?: string
  rows?: Array<[string, string]>
  /** The tag name jumps to its occurrences; only its icon copies it. */
  goTo?: boolean
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 bg-muted/20 px-3 py-3 font-mono text-[11px]">
      {goTo ? (
        <span className="flex items-center gap-1 font-medium text-syntax-tag">
          <IconTag aria-hidden className="size-3 opacity-60" />
          <span className="underline">{tag}</span>
        </span>
      ) : (
        <span className="font-medium text-syntax-tag">{tag}</span>
      )}
      <span className="px-1.5 font-sans whitespace-nowrap text-muted-foreground">
        {m.pin_matches_count({ count: rows.length })}
      </span>
      {rows.map(([parent, value], i) => (
        <Fragment key={parent}>
          <span
            className={cn(
              'relative flex h-6 max-w-36 min-w-0 items-center pl-4 text-[10px] text-muted-foreground',
              'before:absolute before:-top-1 before:left-1 before:w-px before:bg-muted-foreground/40',
              'after:absolute after:top-1/2 after:left-1 after:h-px after:w-1.5 after:bg-muted-foreground/40',
              i === rows.length - 1 ? 'before:bottom-1/2' : 'before:bottom-0',
              i === 1 && 'font-semibold text-foreground',
            )}
          >
            <span className="truncate">{parent}</span>
          </span>
          <span className="flex h-6 min-w-0 items-center gap-1 rounded-md border bg-background pr-1 pl-1.5">
            <span className="flex-1 truncate">{value}</span>
            <IconCopy aria-hidden className="size-3 text-muted-foreground" />
          </span>
        </Fragment>
      ))}
    </div>
  )
}

const DOLLAR_VARS = [
  '<Order>',
  '\t<Id>${$guid}</Id>',
  '\t<Ref>${$stuff$}</Ref>',
  '</Order>',
]

function DollarWrappedVars() {
  return (
    <BeforeAfter
      before={
        <Code
          lines={DOLLAR_VARS.map((line, i) =>
            i === 2 ? (
              <>
                {'\t'}
                <Syn k="punct">{'<'}</Syn>
                <Syn k="tag">Ref</Syn>
                <Syn k="punct">{'>'}</Syn>
                <span className="text-(--syntax-value) underline decoration-(--hl-red) decoration-wavy">
                  {'${$stuff$}'}
                </span>
                <Syn k="punct">{'</'}</Syn>
                <Syn k="tag">Ref</Syn>
                <Syn k="punct">{'>'}</Syn>
              </>
            ) : (
              line
            ),
          )}
        />
      }
      after={<Code lines={DOLLAR_VARS} />}
    />
  )
}

const NOTES = [
  '# Release',
  '',
  'Ships **today**.',
  '',
  '```mermaid',
  'graph LR',
  '  Edit --> Ship',
  '```',
]

/** A Markdown line as the editor colours it: markup steps back. */
function markdownLine(line: string): ReactNode {
  const heading = /^(#+ )(.*)$/.exec(line)
  if (heading)
    return (
      <>
        <Syn k="comment">{heading[1]}</Syn>
        <span className="font-semibold text-foreground">{heading[2]}</span>
      </>
    )
  const strong = /^(.*)\*\*(.+)\*\*(.*)$/.exec(line)
  if (strong)
    return (
      <>
        {strong[1]}
        <Syn k="comment">**</Syn>
        <span className="font-semibold">{strong[2]}</span>
        <Syn k="comment">**</Syn>
        {strong[3]}
      </>
    )
  return line.startsWith('```') ? <Syn k="comment">{line}</Syn> : line
}

function DiagramBox({ children }: { children: ReactNode }) {
  return (
    <span className="border bg-muted/40 px-2 py-1 text-[10px]">{children}</span>
  )
}

function MarkdownPreview() {
  return (
    <Shot>
      <Tabs>
        <Tab name="release.md" active />
      </Tabs>
      <div className="grid grid-cols-2 divide-x">
        <Code lines={NOTES} format={markdownLine} />
        <div className="grid content-start gap-2 p-3">
          <span className="text-sm font-semibold tracking-tight">Release</span>
          <span>
            Ships <strong className="font-semibold">today</strong>.
          </span>
          <div className="flex items-center justify-center gap-1.5 border p-3 text-muted-foreground">
            <DiagramBox>Edit</DiagramBox>
            <span aria-hidden>→</span>
            <DiagramBox>Ship</DiagramBox>
          </div>
        </div>
      </div>
    </Shot>
  )
}

const TODO = ['Call the carrier', 'Reprint <label> 42', '', 'Ship by Friday']

function SiteMark({ name, home }: { name: string; home?: string }) {
  return (
    <div className="flex h-10 items-center gap-4 px-3 text-xs">
      <span className="font-semibold">{name}</span>
      {home && <span className="text-muted-foreground">{home}</span>}
      <span className="text-muted-foreground">{m.nav_about()}</span>
      <span className="text-muted-foreground">{m.nav_changelog()}</span>
    </div>
  )
}

function RenamedSite() {
  return (
    <BeforeAfter
      before={<SiteMark name="XML Editor" />}
      after={<SiteMark name="Editor" />}
    />
  )
}

function HeaderWithoutRepeat() {
  return (
    <BeforeAfter
      before={<SiteMark name="Editor" home="Editor" />}
      after={<SiteMark name="Editor" />}
    />
  )
}

function PlainTextFile() {
  return (
    <Shot>
      <Tabs>
        <Tab name="todo.txt" active />
      </Tabs>
      <Code lines={TODO} format={(line) => line} />
    </Shot>
  )
}

function PinTagGoTo() {
  return (
    <BeforeAfter
      before={<PinOccurrenceTree />}
      after={<PinOccurrenceTree goTo />}
    />
  )
}

function PinOccurrenceRail() {
  return (
    <BeforeAfter before={<PinOccurrence />} after={<PinOccurrenceTree />} />
  )
}

function PinOccurrenceRepeated() {
  return (
    <BeforeAfter
      before={
        <PinOccurrenceTree
          tag="ItemNumber"
          rows={[
            ['ShipmentLines/ShipmentLine[1]', 'SKU-10001'],
            ['ShipmentLines/ShipmentLine[2]', 'SKU-10002'],
            ['Cartons/Carton[1]/Contents/Item', 'SKU-10001'],
            ['Cartons/Carton[2]/Contents/Item', 'SKU-10002'],
          ]}
        />
      }
      after={
        <PinOccurrenceTree
          tag="ItemNumber"
          rows={[
            ['ShipmentLine[1]', 'SKU-10001'],
            ['ShipmentLine[2]', 'SKU-10002'],
            ['Carton[1]/[...]', 'SKU-10001'],
            ['Carton[2]/[...]', 'SKU-10002'],
          ]}
        />
      }
    />
  )
}

function PinOccurrenceDiff() {
  return (
    <BeforeAfter
      before={
        <PinOccurrenceTree
          tag="LineNumber"
          rows={[
            ['ShipmentLine[1]/Detail', '1'],
            ['ShipmentLine[2]/Detail', '2'],
          ]}
        />
      }
      after={
        <PinOccurrenceTree
          tag="LineNumber"
          rows={[
            ['ShipmentLine[1]/[...]', '1'],
            ['ShipmentLine[2]/[...]', '2'],
          ]}
        />
      }
    />
  )
}

function figure(...parts: Array<ComponentType>): ComponentType {
  return function Preview() {
    return (
      <Figure>
        {parts.map((Part, i) => (
          <Part key={i} />
        ))}
      </Figure>
    )
  }
}

function ZplWorkspace() {
  return (
    <BeforeAfter
      before={
        <>
          <Tabs>
            <Tab name="shipment.xml" active />
          </Tabs>
          <Code lines={['<shipment>', '  <id>4821</id>', '</shipment>']} />
        </>
      }
      after={
        <>
          <Tabs>
            <Tab name="shipment.xml" />
            <Tab name="label.zpl" active />
          </Tabs>
          <div className="grid grid-cols-2 divide-x">
            <Code lines={['<shipment>', '  <id>4821</id>', '</shipment>']} />
            <div>
              <Code
                lines={['^XA', '^FO20,20^FD4821^FS', '^XZ']}
                format={(line) => line}
              />
              <div className="border-t bg-muted p-3">
                <div className="mx-auto w-24 border border-black/20 bg-white p-3 font-mono text-black">
                  <span>4821</span>
                  <svg
                    viewBox="0 0 72 20"
                    className="mt-2 w-full"
                    aria-hidden="true"
                  >
                    {[
                      0, 4, 7, 12, 18, 21, 27, 31, 36, 42, 45, 50, 56, 61, 66,
                      70,
                    ].map((x) => (
                      <rect
                        key={x}
                        x={x}
                        width={(x % 3) + 1}
                        height="20"
                        fill="currentColor"
                      />
                    ))}
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <StatusBar>
            <span>{m.zpl_preview_label()}</span>
            <span className="ml-auto">{m.zpl_status_one_label()}</span>
          </StatusBar>
        </>
      }
    />
  )
}

function ZplOneBar() {
  const label = (
    <div className="mx-auto w-20 border border-black/20 bg-white p-2 font-mono text-xs text-black">
      4821
    </div>
  )
  const code = (
    <Code
      lines={['^XA', '^FO20,20^FD4821^FS', '^XZ']}
      format={(line) => line}
    />
  )
  const row = 'flex items-center gap-3 border-b px-2 py-1.5 text-xs'
  return (
    <BeforeAfter
      before={
        <>
          <Tabs>
            <Tab name="label.zpl" active />
          </Tabs>
          <div className={row}>
            <span>{m.zpl_settings()}</span>
            <span className="ml-auto border px-1.5">PDF PNG ZPL</span>
          </div>
          <div className={row}>
            <span>{m.zpl_explain()}</span>
            <span>{m.zpl_sync_zoom()}</span>
          </div>
          <div className="border-b bg-muted p-3">{label}</div>
          <div className={row}>
            <span>{m.zpl_status_one_label()}</span>
            <span className="ml-auto">{m.zpl_zoom_fit_short()}</span>
          </div>
          {code}
        </>
      }
      after={
        <>
          <div className="flex items-center border-b">
            <div className="min-w-0 flex-1">
              <Tabs>
                <Tab name="label.zpl" active />
              </Tabs>
            </div>
            <div className="flex h-8 items-center gap-1.5 border-b bg-muted/60 px-2 text-xs text-muted-foreground">
              <IconAdjustmentsHorizontal className="size-3.5" />
              <span className="flex items-center gap-0.5 border px-1.5 text-foreground">
                {m.zpl_download()}
                <IconChevronDown className="size-3" />
              </span>
              <IconDots className="size-3.5" />
            </div>
          </div>
          <div className="relative bg-muted p-3 pb-9">
            {label}
            <span className="absolute bottom-1.5 left-1.5 border bg-background px-1.5 text-[11px] text-muted-foreground">
              {m.zpl_status_one_label()}
            </span>
            <span className="absolute right-1.5 bottom-1.5 border bg-background px-1.5 text-[11px] text-muted-foreground">
              {m.zpl_zoom_fit_short()}
            </span>
          </div>
          {code}
        </>
      }
    />
  )
}

function ZplPreviewOnTop() {
  const code = (
    <Code
      lines={['^XA', '^FO20,20^FD4821^FS', '^XZ']}
      format={(line) => line}
    />
  )
  const label = (
    <div className="bg-muted p-3">
      <div className="mx-auto w-20 border border-black/20 bg-white p-2 font-mono text-xs text-black">
        4821
      </div>
    </div>
  )
  return (
    <BeforeAfter
      before={
        <>
          {code}
          <div className="border-t">{label}</div>
        </>
      }
      after={
        <>
          <div className="border-b">{label}</div>
          {code}
        </>
      }
    />
  )
}

function ZplLoneToolbar() {
  const bar = (dim: boolean) => (
    <>
      <Tabs>
        <Tab name="label.zpl" active />
      </Tabs>
      <div className="flex items-center gap-3 border-b px-2 py-1.5 text-xs">
        <span>{m.zpl_explain()}</span>
        <span className={dim ? 'opacity-45' : undefined}>
          {m.zpl_sync_zoom()}
        </span>
        <span
          className={`ml-auto border px-2 py-0.5 ${dim ? 'opacity-45' : ''}`}
        >
          {m.zpl_compare_none()}
        </span>
      </div>
    </>
  )
  return <BeforeAfter before={bar(false)} after={bar(true)} />
}

function ZplSideBySide() {
  const code = (
    <Code
      lines={['^XA', '^FO20,20^FD4821^FS', '^XZ']}
      format={(line) => line}
    />
  )
  const label = (
    <div className="bg-muted p-3">
      <div className="mx-auto w-20 border border-black/20 bg-white p-2 font-mono text-xs text-black">
        4821
      </div>
    </div>
  )
  return (
    <BeforeAfter
      before={
        <>
          <Tabs>
            <Tab name="label.zpl" active />
          </Tabs>
          {code}
          <div className="border-t">{label}</div>
        </>
      }
      after={
        <>
          <Tabs>
            <Tab name="label.zpl" active />
          </Tabs>
          <div className="grid grid-cols-2 divide-x">
            {code}
            {label}
          </div>
        </>
      }
    />
  )
}

function PaneTabs() {
  const names = ['order.xml', 'response.xml']
  const lines = [
    ['<order>', '  <id>1042</id>', '</order>'],
    ['<response>', '  <id>1042</id>', '</response>'],
  ]
  return (
    <BeforeAfter
      before={
        <>
          <Tabs>
            {names.map((name, i) => (
              <Tab key={name} name={name} active={i === 0} />
            ))}
          </Tabs>
          <div className="grid grid-cols-2 divide-x">
            {names.map((name, i) => (
              <div key={name}>
                <StatusBar className="border-t-0 border-b">
                  <span className="truncate">{name}</span>
                </StatusBar>
                <Code lines={lines[i]} />
              </div>
            ))}
          </div>
        </>
      }
      after={
        <div className="grid grid-cols-2 divide-x">
          {names.map((name, i) => (
            <div key={name} className="min-w-0">
              <StatusBar className="border-t-0 border-b">
                <span className="truncate border-b-2 border-foreground py-2 font-medium">
                  {name}
                </span>
                <span className="ml-auto text-muted-foreground">
                  {m.pane_split()}
                </span>
              </StatusBar>
              <Code lines={lines[i]} />
            </div>
          ))}
        </div>
      }
    />
  )
}

function CardTabs() {
  const panes = [
    {
      tabs: [
        ['order.xml', BLUE],
        ['rates.json', GREEN],
      ],
      lines: ['<order>', '  <id>1042</id>', '</order>'],
    },
    {
      tabs: [['label.xml', PURPLE]],
      lines: ['<label>', '  <id>1042</id>', '</label>'],
    },
  ]
  const buttons = (split: boolean) => (
    <>
      {split && <IconLayoutColumns />}
      <IconDots />
    </>
  )
  // Stacked rather than side by side, so each pane has room for its tabs.
  return (
    <>
      <Shot label={m.changelog_before()}>
        <div className="grid grid-cols-2 divide-x">
          {panes.map((pane) => (
            <div key={pane.tabs[0][0]} className="min-w-0">
              <div className="flex h-8 items-stretch border-b text-[11px]">
                <div className="flex min-w-0 flex-1 items-stretch overflow-hidden px-1">
                  {pane.tabs.map(([name, color], i) => (
                    <span
                      key={name}
                      className={cn(
                        'flex shrink-0 items-center gap-1 px-1.5',
                        i === 0
                          ? 'shadow-[inset_0_-2px_var(--foreground)]'
                          : 'text-muted-foreground',
                      )}
                    >
                      <IconFileCode className="size-3 shrink-0 text-muted-foreground" />
                      <span
                        style={{ '--hl': color } as CSSProperties}
                        className="hl-tag hl-ink truncate px-1 leading-4"
                      >
                        {name}
                      </span>
                    </span>
                  ))}
                </div>
                <div className="flex shrink-0 items-center gap-1.5 px-2 text-muted-foreground [&_svg]:size-3.5">
                  {buttons(true)}
                </div>
              </div>
              <Code lines={pane.lines} />
            </div>
          ))}
        </div>
      </Shot>
      <Shot label={m.changelog_after()}>
        <div className="grid grid-cols-2 divide-x">
          {panes.map((pane, i) => (
            <div key={pane.tabs[0][0]} className="min-w-0">
              <SheetTabs end={buttons(i === panes.length - 1)}>
                {pane.tabs.map(([name, color], j) => (
                  <SheetTab
                    key={name}
                    name={name}
                    color={color}
                    active={j === 0}
                  />
                ))}
              </SheetTabs>
              <Code lines={pane.lines} />
            </div>
          ))}
        </div>
      </Shot>
    </>
  )
}

function TabFocusRing() {
  const pane = (ring: boolean) => (
    <>
      <SheetTabs>
        <SheetTab name="orders.xml" color={BLUE} />
        <div className="relative flex h-full">
          <SheetTab name="untitled-3.zpl" color={BLUE} active />
          {ring && (
            <span className="pointer-events-none absolute top-1 right-5 bottom-0.5 left-1 border-2 border-ring" />
          )}
        </div>
      </SheetTabs>
      <Code lines={['^XA', '^FO50,50^FDACME^FS', '^XZ']} format={(l) => l} />
    </>
  )
  return <BeforeAfter before={pane(true)} after={pane(false)} />
}

function TabClickOutline() {
  const pane = (outline: boolean) => (
    <>
      <SheetTabs>
        <SheetTab name="orders.xml" color={BLUE} />
        <div className="relative flex h-full">
          <SheetTab name="label.zpl" color={BLUE} active />
          {outline && (
            <span className="pointer-events-none absolute inset-0.5 bottom-0 rounded-t-md border-2 border-ring" />
          )}
        </div>
      </SheetTabs>
      <Code lines={['^XA', '^FO50,50^FDACME^FS', '^XZ']} format={(l) => l} />
    </>
  )
  return <BeforeAfter before={pane(true)} after={pane(false)} />
}

const WRAP_LINES = [
  '<order id="1042">',
  '  <note>Leave the parcel with the front desk if nobody answers the door after two rings.</note>',
  '</order>',
]

function WordWrap() {
  const pane = (wrap: boolean) => (
    <>
      <Code lines={WRAP_LINES} wrap={wrap} />
      <StatusBar>
        <div className="flex-1" />
        <span
          className={cn(
            'flex size-6 items-center justify-center',
            wrap && 'bg-muted text-foreground',
          )}
        >
          <IconTextWrap className="size-3.5" />
        </span>
      </StatusBar>
    </>
  )
  return <BeforeAfter before={pane(false)} after={pane(true)} />
}

function ZplTabSheet() {
  const pane = (joined: boolean) => (
    <div className={joined ? '[--sheet:var(--muted)]' : undefined}>
      <SheetTabs end={<IconDots />}>
        <SheetTab name="label.zpl" color={BLUE} active />
        <SheetTab name="label-3.zpl" color={BLUE} />
      </SheetTabs>
      <div className="bg-muted p-3">
        <div className="mx-auto w-20 border border-black/20 bg-white p-2 font-mono text-xs text-black">
          ACME
        </div>
      </div>
    </div>
  )
  return <BeforeAfter before={pane(false)} after={pane(true)} />
}

function ClosePane() {
  const panes = [
    { name: 'order.xml', color: BLUE, lines: ['<order>', '  <id>1042</id>'] },
    { name: 'label.xml', color: PURPLE, lines: ['<label>', '  <id>1042</id>'] },
  ]
  const split = (close: boolean) => (
    <div className="grid grid-cols-2 divide-x">
      {panes.map((pane, i) => (
        <div key={pane.name} className="min-w-0">
          <SheetTabs
            end={
              <>
                {close && <IconColumnsOff className="text-foreground" />}
                {i === panes.length - 1 && <IconLayoutColumns />}
                <IconDots />
              </>
            }
          >
            <SheetTab name={pane.name} color={pane.color} active />
          </SheetTabs>
          <Code lines={pane.lines} />
        </div>
      ))}
    </div>
  )
  return (
    <>
      <Shot label={m.changelog_before()}>{split(false)}</Shot>
      <Shot label={m.changelog_after()}>{split(true)}</Shot>
    </>
  )
}

function PaneButtonPlaces() {
  const panes = [
    { name: 'order.xml', color: BLUE, lines: ['<order>', '  <id>1042</id>'] },
    { name: 'label.xml', color: PURPLE, lines: ['<label>', '  <id>1042</id>'] },
  ]
  const split = (fixed: boolean) => (
    <div className="grid grid-cols-2 divide-x">
      {panes.map((pane, i) => {
        const first = i === 0
        const last = i === panes.length - 1
        return (
          <div key={pane.name} className="min-w-0">
            <SheetTabs
              end={
                <>
                  {(fixed ? last : true) && <IconColumnsOff />}
                  {(fixed ? first : last) && <IconLayoutColumns />}
                  <IconDots />
                </>
              }
            >
              <SheetTab name={pane.name} color={pane.color} active />
            </SheetTabs>
            <Code lines={pane.lines} />
          </div>
        )
      })}
    </div>
  )
  return (
    <>
      <Shot label={m.changelog_before()}>{split(false)}</Shot>
      <Shot label={m.changelog_after()}>{split(true)}</Shot>
    </>
  )
}

function ZplQuietStatus() {
  const preview = (status?: ReactNode) => (
    <div className="relative bg-muted p-3 pb-10">
      <div className="mx-auto w-20 border border-black/20 bg-white p-2 font-mono text-xs text-black">
        4821
      </div>
      <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
        {m.zpl_label_caption({ index: 1, count: 1 })}
      </p>
      {status && (
        <span className="absolute bottom-1.5 left-1.5 flex gap-2 border bg-background px-1.5 text-[11px] text-muted-foreground">
          {status}
        </span>
      )}
    </div>
  )
  return (
    <BeforeAfter
      before={preview(
        <>
          <span>{m.zpl_status_one_label()}</span>
          <span>{m.zpl_status_no_problems()}</span>
        </>,
      )}
      after={preview()}
    />
  )
}

function ZplCentered() {
  const preview = (centered: boolean) => (
    <div
      className={cn(
        'flex h-40 flex-col items-center bg-muted p-3',
        centered && 'justify-center',
      )}
    >
      <div className="w-20 border border-black/20 bg-white p-2 font-mono text-xs text-black">
        4821
      </div>
      <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
        {m.zpl_label_caption({ index: 1, count: 1 })}
      </p>
    </div>
  )
  return <BeforeAfter before={preview(false)} after={preview(true)} />
}

function BottomBarOverflow() {
  const profile = (name: string, color: string, active?: boolean) => (
    <span
      style={{ '--hl': color } as CSSProperties}
      className={cn(
        'inline-flex h-5 items-center gap-1.5 border px-1.5 not-first:border-l-0',
        active && 'hl-ink bg-(--hl)/15 font-medium',
      )}
    >
      <span className="size-1.5 rounded-full bg-(--hl)" />
      {name}
    </span>
  )
  const more = (count: number) => (
    <span className="inline-flex h-5 items-center gap-0.5 border px-1 font-mono">
      +{count}
      <IconChevronUp className="size-3" />
    </span>
  )
  const chips = [
    ['order', BLUE, 4],
    ['sku', PURPLE, 12],
    ['carrier', TEAL, 2],
    ['price', AMBER, 9],
    ['qty', GREEN, 1],
  ] as const
  const profiles = [
    ['Orders', BLUE],
    ['Rates', PURPLE],
    ['Labels', TEAL],
    ['Invoices', AMBER],
    ['Returns', GREEN],
    ['Legacy', BLUE],
  ] as const
  return (
    <BeforeAfter
      before={
        <StatusBar className="overflow-hidden border-t-0">
          {chips.map(([name, color, count]) => (
            <Chip key={name} name={name} color={color} count={count} />
          ))}
          <span className="flex">
            {profiles.map(([name, color], i) => (
              <span key={name} className="contents">
                {profile(name, color, i === 0)}
              </span>
            ))}
          </span>
        </StatusBar>
      }
      after={
        <StatusBar className="border-t-0">
          <Chip name="order" color={BLUE} count={4} />
          <Chip name="sku" color={PURPLE} count={12} />
          <Chip name="price" color={AMBER} count={9} />
          {more(2)}
          <span className="flex-1" />
          <span className="flex">
            {profile('Orders', BLUE, true)}
            {profile('Rates', PURPLE)}
            {profile('Labels', TEAL)}
            {profile('Invoices', AMBER)}
            {more(2)}
          </span>
        </StatusBar>
      }
    />
  )
}

function BottomBarMenus() {
  const dot = (color: string) => (
    <span
      style={{ '--hl': color } as CSSProperties}
      className="size-2 rounded-full bg-(--hl) ring-1 ring-background"
    />
  )
  return (
    <BeforeAfter
      before={
        <StatusBar className="border-t-0">
          <Chip name="order" color={BLUE} count={4} />
          <Chip name="sku" color={PURPLE} count={12} />
          <Chip name="price" color={AMBER} count={9} />
          <span className="border px-1 font-mono">+2</span>
          <span className="flex-1" />
          <span className="border px-1.5">Orders</span>
          <span className="border border-l-0 px-1.5">Rates</span>
          <span className="border border-l-0 px-1.5">Labels</span>
          <span className="border border-l-0 px-1 font-mono">+3</span>
        </StatusBar>
      }
      after={
        <StatusBar className="border-t-0">
          <span className="flex items-center gap-1.5 px-1.5 text-foreground">
            <span className="flex -space-x-0.5">
              {dot(BLUE)}
              {dot(PURPLE)}
              {dot(AMBER)}
              {dot(TEAL)}
              {dot(GREEN)}
            </span>
            {m.highlights_title()}
            <span className="font-mono text-[10px] text-muted-foreground">
              28
            </span>
            <IconChevronUp className="size-3" />
          </span>
          <span className="flex-1" />
          <span
            style={{ '--hl': BLUE } as CSSProperties}
            className="flex items-center gap-1.5 px-1.5"
          >
            {m.status_profile()}
            <span className="size-1.5 rounded-full bg-(--hl)" />
            <span className="hl-ink font-medium">Orders</span>
            <IconChevronUp className="size-3" />
          </span>
        </StatusBar>
      }
    />
  )
}

function NoticeSlot() {
  const profile = (
    <span
      style={{ '--hl': BLUE } as CSSProperties}
      className="flex items-center gap-1.5 px-1.5"
    >
      {m.status_profile()}
      <span className="size-1.5 rounded-full bg-(--hl)" />
      <span className="hl-ink font-medium">Orders</span>
      <IconChevronUp className="size-3" />
    </span>
  )
  const actions = (
    <span className="flex items-center gap-1 px-1.5 text-foreground">
      <IconWand className="size-3" />
      {m.action_format()}
    </span>
  )
  const notice = (
    <span className="flex items-center gap-1.5 px-1.5 text-foreground">
      <IconCheck className="size-3" />
      {m.copied()}
    </span>
  )
  return (
    <BeforeAfter
      before={
        <StatusBar className="border-t-0">
          <span className="flex-1" />
          <span className="relative flex items-center">
            {profile}
            <span className="absolute inset-y-0 right-0 flex items-center bg-[color-mix(in_oklab,var(--foreground)_5%,var(--background))] shadow-[inset_0_-1px_var(--border)]">
              {notice}
            </span>
          </span>
          {actions}
        </StatusBar>
      }
      after={
        <StatusBar className="border-t-0">
          <span className="flex flex-1 justify-end">{notice}</span>
          {profile}
          {actions}
        </StatusBar>
      }
    />
  )
}

const PROBLEM_LINES = ['<order>', '  <id>1042', '</order>', '<note/>']

function ProblemLanguage() {
  const pane = (problems: Array<string>) => (
    <>
      <Code lines={PROBLEM_LINES} marks={{ 1: 'remove', 3: 'remove' }} />
      <div className="border-t bg-destructive/5 px-3 py-2">
        <div className="mb-1 flex items-center gap-1.5 font-medium text-destructive">
          <IconAlertTriangle className="size-3.5" />
          {m.tree_errors({ count: problems.length })}
        </div>
        <ul className="space-y-0.5 text-muted-foreground">
          {problems.map((problem) => (
            <li key={problem} className="truncate">
              {problem}
            </li>
          ))}
        </ul>
      </div>
    </>
  )
  // Before, every reader got the English text; now a French one reads this.
  const fr = { locale: 'fr' } as const
  return (
    <BeforeAfter
      before={pane(['<id> is not closed', 'Only one root element is allowed'])}
      after={pane([
        m.parse_xml_not_closed({ name: 'id' }, fr),
        m.parse_xml_one_root({}, fr),
      ])}
    />
  )
}

function ExplorerPreview() {
  return (
    <BeforeAfter
      before={
        <>
          <Tabs>
            <Tab name="order.xml" active />
            <Tab name="query.sql" />
          </Tabs>
          <Code lines={ORDER} />
        </>
      }
      after={
        <div className="flex">
          <div className="min-w-0 flex-1">
            <Tabs>
              <Tab name="order.xml" active />
            </Tabs>
            <Code lines={ORDER} />
          </div>
          <div className="w-36 shrink-0 border-l">
            <div className="border-b px-3 py-2 font-medium">
              {m.explorer_title()}
            </div>
            <div className="space-y-2 p-3">
              <div className="flex items-center gap-1">
                <IconChevronDown className="size-3" />
                <IconFolderOpen className="size-3" />
                {m.explorer_root()}
              </div>
              <div className="bg-accent py-1 pl-4 text-accent-foreground">
                order.xml
              </div>
              <div className="pl-4">query.sql</div>
            </div>
          </div>
        </div>
      }
    />
  )
}

function ExplorerRows({ after }: { after?: boolean }) {
  return (
    <div className="w-48 space-y-0.5 p-2">
      <div
        className={
          after ? 'bg-muted/60 px-2 py-1 text-foreground' : 'flex bg-muted'
        }
      >
        {after ? (
          'order.xml'
        ) : (
          <>
            <span className="flex-1 bg-background/70 px-2 py-1">order.xml</span>
            <span className="px-2 py-1">…</span>
          </>
        )}
      </div>
      <div
        className={
          after
            ? 'bg-muted px-2 py-1 font-medium text-foreground'
            : 'bg-accent px-2 py-1 text-accent-foreground'
        }
      >
        query.sql
      </div>
      <div className="px-2 py-1 text-muted-foreground">notes.md</div>
    </div>
  )
}

function FolderFiles({ after }: { after?: boolean }) {
  const row = 'flex items-center gap-1.5 px-2 py-1 [&_svg]:size-3.5'
  return (
    <div className="w-48 space-y-0.5 p-2 text-muted-foreground">
      <div className={row}>
        <IconChevronDown />
        <IconFolder />
        img
      </div>
      <div className="ml-3 border-l pl-1">
        {after && (
          <div className={cn(row, 'opacity-50')}>
            <IconPhoto />
            logo.png
          </div>
        )}
      </div>
      <div className={cn(row, 'bg-muted font-medium text-foreground')}>
        <IconMarkdown />
        notes.md
      </div>
      {after && (
        <div className={cn(row, 'opacity-50')}>
          <IconFileDots />
          report.pdf
        </div>
      )}
    </div>
  )
}

function UnsupportedFiles() {
  return <BeforeAfter before={<FolderFiles />} after={<FolderFiles after />} />
}

function ExplorerHover() {
  return (
    <BeforeAfter before={<ExplorerRows />} after={<ExplorerRows after />} />
  )
}

function FolderWorkspaces() {
  return (
    <Shot>
      <WorkspacesView />
    </Shot>
  )
}

/** Since 1.31.0 the active tab's folders open in the explorer. */
function RevealActiveTab() {
  return (
    <BeforeAfter
      before={<WorkspacesView closed />}
      after={<WorkspacesView />}
    />
  )
}

/** The editor beside an explorer holding a folder opened from disk. */
function WorkspacesView({ closed }: { closed?: boolean }) {
  const row = 'flex items-center gap-1.5 px-2 py-1 [&_svg]:size-3.5'
  const nested = 'ml-3 border-l pl-1 text-muted-foreground'
  return (
    <div className="flex">
      <div className="min-w-0 flex-1">
        <Tabs>
          <Tab name="order.xml" active />
          <Tab name="rates.json" />
        </Tabs>
        <Code lines={ORDER} />
      </div>
      <div className="w-44 shrink-0 border-l">
        <div className="border-b px-3 py-2 font-medium">
          {m.explorer_title()}
        </div>
        <div className="p-2">
          <div className={cn(row, 'font-medium')}>
            <IconChevronDown />
            <IconBrowser />
            {m.explorer_browser()}
          </div>
          <div className={nested}>
            <div className={row}>
              <IconFileCode />
              notes.xml
            </div>
          </div>
          <div className={cn(row, 'mt-2 font-medium')}>
            <IconChevronDown />
            <IconFolderRoot />
            invoices
          </div>
          <div className={nested}>
            <div className={row}>
              {closed ? <IconChevronRight /> : <IconChevronDown />}
              <IconFolder />
              2026
            </div>
            {!closed && (
              <div className={nested}>
                <div
                  className={cn(row, 'bg-muted font-medium text-foreground')}
                >
                  <IconFileCode />
                  order.xml
                </div>
              </div>
            )}
            <div className={row}>
              <IconJson />
              rates.json
            </div>
          </div>
          <div className={cn(row, 'mt-2 font-medium')}>
            <IconChevronRight />
            <IconFolderRoot />
            labels
          </div>
        </div>
      </div>
    </div>
  )
}

/** Since 1.38.0 a browser file whose tab closes stays in the explorer. */
function ClosedTabsKept() {
  return (
    <BeforeAfter
      before={<ClosedTabView kept={false} />}
      after={<ClosedTabView kept />}
    />
  )
}

/** The editor after closing notes.xml, beside the browser's files. */
function ClosedTabView({ kept }: { kept: boolean }) {
  const row = 'flex items-center gap-1.5 px-2 py-1 [&_svg]:size-3.5'
  return (
    <div className="flex">
      <div className="min-w-0 flex-1">
        <Tabs>
          <Tab name="order.xml" active />
        </Tabs>
        <Code lines={ORDER} />
      </div>
      <div className="w-36 shrink-0 border-l">
        <div className="border-b px-3 py-2 font-medium">
          {m.explorer_title()}
        </div>
        <div className="p-2">
          <div className={cn(row, 'font-medium')}>
            <IconChevronDown />
            <IconBrowser />
            {m.explorer_browser()}
          </div>
          <div className="ml-3 border-l pl-1">
            {kept && (
              <div className={cn(row, 'text-muted-foreground')}>
                <IconFileCode />
                notes.xml
              </div>
            )}
            <div className={cn(row, 'bg-muted font-medium')}>
              <IconFileCode />
              order.xml
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ExplorerHints() {
  const icon = 'flex size-6 items-center justify-center [&_svg]:size-3.5'
  return (
    <Shot>
      <div className="flex justify-end p-3 pb-16">
        <div className="relative w-56 border">
          <div className="flex items-center gap-1 border-b px-2 py-1.5">
            <span className="flex-1 font-medium">{m.explorer_title()}</span>
            <span className={icon}>
              <IconFilePlus />
            </span>
            <span className={icon}>
              <IconFolderPlus />
            </span>
            <span className={icon}>
              <IconUpload />
            </span>
            <span className={icon}>
              <IconFolderUp />
            </span>
            <span className={cn(icon, 'bg-muted')}>
              <IconFolderRoot />
            </span>
          </div>
          <div className="absolute top-full right-0 mt-1 flex w-52 flex-col gap-0.5 bg-foreground px-3 py-1.5 text-background">
            <span>{m.folder_open()}</span>
            <span className="text-background/70">{m.folder_open_hint()}</span>
          </div>
        </div>
      </div>
    </Shot>
  )
}

function ExplorerNewMenu() {
  const icon = 'flex size-6 items-center justify-center [&_svg]:size-3.5'
  const item = 'flex items-start gap-2 px-2 py-1 [&_svg]:mt-px [&_svg]:size-3.5'
  const section = 'px-2 pt-1.5 pb-0.5 text-[0.625rem] text-muted-foreground'
  return (
    <BeforeAfter
      className="h-56"
      before={
        <div className="p-3">
          <div className="flex items-center gap-1 border px-2 py-1.5">
            <span className="flex-1 font-medium">{m.explorer_title()}</span>
            {[
              IconFilePlus,
              IconFolderPlus,
              IconUpload,
              IconFolderUp,
              IconFolderRoot,
            ].map((Icon, index) => (
              <span key={index} className={icon}>
                <Icon />
              </span>
            ))}
          </div>
        </div>
      }
      after={
        <div className="relative p-3">
          <div className="flex items-center gap-1 border px-2 py-1.5">
            <span className="flex-1 font-medium">{m.explorer_title()}</span>
            <span className="flex h-6 items-center gap-1 border bg-muted px-2 [&_svg]:size-3">
              <IconPlus />
              {m.explorer_new()}
              <IconChevronDown />
            </span>
          </div>
          <div className="absolute top-12 right-3 w-56 border bg-popover py-1 shadow-md">
            <div className={section}>{m.explorer_in_browser()}</div>
            <div className={cn(item, 'bg-muted')}>
              <IconFilePlus />
              {m.file_new()}
            </div>
            <div className={section}>{m.explorer_from_device()}</div>
            <div className={item}>
              <IconUpload />
              <span className="grid">
                {m.explorer_import()}
                <span className="text-muted-foreground">
                  {m.explorer_import_hint()}
                </span>
              </span>
            </div>
            <div className={item}>
              <IconFolderRoot />
              <span className="grid">
                {m.folder_open()}
                <span className="text-muted-foreground">
                  {m.folder_open_desc()}
                </span>
              </span>
            </div>
          </div>
        </div>
      }
    />
  )
}

type CodeLook = 'filled' | 'framed' | 'quiet' | 'blue' | 'padded' | 'square'

const INLINE_CODE: Record<CodeLook, string> = {
  filled: 'rounded bg-muted px-1',
  framed: 'rounded border bg-muted px-1 text-[0.85em] font-medium',
  quiet: 'rounded-sm bg-muted px-[0.3em] text-[0.875em]',
  blue: 'rounded bg-(--hl-blue)/10 px-[0.3em] text-[0.85em] text-(--sql-keyword)',
  padded:
    'rounded bg-(--hl-blue)/10 px-[0.45em] py-[0.2em] text-[0.85em] text-(--sql-keyword)',
  square:
    'bg-(--hl-blue)/10 px-[0.45em] py-[0.2em] text-[0.85em] text-(--sql-keyword)',
}

function PreviewCode({ look }: { look: CodeLook }) {
  const line = (
    <span className="text-(--sql-keyword)">
      const <span className="text-foreground">doc = </span>
      <span className="text-(--sql-function)">parse</span>
      <span className="text-foreground">(</span>
      <span className="text-(--sql-string)">'&lt;a/&gt;'</span>
      <span className="text-foreground">)</span>
    </span>
  )
  return (
    <div className="grid gap-3 p-3">
      <span>
        Call <code className={cn('font-mono', INLINE_CODE[look])}>parse()</code>{' '}
        first.
      </span>
      {look === 'filled' ? (
        <pre className="rounded-md border bg-muted/40 px-2.5 py-2 font-mono">
          {line}
        </pre>
      ) : (
        <div
          className={cn(
            'overflow-hidden border',
            look !== 'square' && 'rounded-md',
          )}
        >
          <div className="flex h-7 items-center justify-between border-b pr-1 pl-2.5">
            <span className="font-mono text-muted-foreground">ts</span>
            {look === 'framed' ? (
              <Button variant="outline" size="xs" className="h-5">
                {m.md_code_copy()}
              </Button>
            ) : (
              <IconCopy
                aria-hidden
                className="mr-1 size-3 text-muted-foreground"
              />
            )}
          </div>
          <pre className="px-2.5 py-2 font-mono">{line}</pre>
        </div>
      )}
    </div>
  )
}

function CodeBlockFrame() {
  return (
    <BeforeAfter
      before={<PreviewCode look="filled" />}
      after={<PreviewCode look="framed" />}
    />
  )
}

function QuietCode() {
  return (
    <BeforeAfter
      before={<PreviewCode look="framed" />}
      after={<PreviewCode look="quiet" />}
    />
  )
}

function BlueCode() {
  return (
    <BeforeAfter
      before={<PreviewCode look="quiet" />}
      after={<PreviewCode look="blue" />}
    />
  )
}

function PaddedCode() {
  return (
    <BeforeAfter
      before={<PreviewCode look="blue" />}
      after={<PreviewCode look="padded" />}
    />
  )
}

function SquareCode() {
  return (
    <BeforeAfter
      before={<PreviewCode look="padded" />}
      after={<PreviewCode look="square" />}
    />
  )
}

function ObsidianVault() {
  const row = 'flex items-center gap-1.5 px-2 py-1 [&_svg]:size-3.5'
  const nested = 'ml-3 border-l pl-1 text-muted-foreground'
  return (
    <Shot>
      <div className="flex">
        <div className="min-w-0 flex-1">
          <Tabs>
            <Tab name="Plan.md" active />
          </Tabs>
          <div className="grid content-start gap-2 p-3">
            <span className="text-sm font-semibold tracking-tight">Plan</span>
            <span>
              Start from{' '}
              <span className="underline underline-offset-2">Ideas</span>, then{' '}
              <span className="text-muted-foreground underline decoration-dotted underline-offset-2">
                Budget
              </span>
              .
            </span>
            <div className="grid gap-1 border-l-2 border-foreground/25 bg-muted/50 px-3 py-1.5">
              <span className="font-medium">Tip</span>
              <span>
                Water{' '}
                <mark className="bg-foreground/10 px-px text-inherit">
                  the plants
                </mark>{' '}
                first.
              </span>
            </div>
          </div>
        </div>
        <div className="w-40 shrink-0 border-l">
          <div className="border-b px-3 py-2 font-medium">
            {m.explorer_title()}
          </div>
          <div className="p-2">
            <div className={cn(row, 'font-medium')}>
              <IconChevronDown />
              <IconNotebook />
              Notes
            </div>
            <div className={nested}>
              <div className={row}>
                <IconChevronDown />
                <IconFolder />
                Projects
              </div>
              <div className={nested}>
                <div
                  className={cn(row, 'bg-muted font-medium text-foreground')}
                >
                  <IconMarkdown />
                  Plan.md
                </div>
                <div className={row}>
                  <IconMarkdown />
                  Ideas.md
                </div>
              </div>
              <div className={row}>
                <IconMarkdown />
                Home.md
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shot>
  )
}

const PASTED = [
  '# Trip',
  '',
  'The view from the top:',
  '',
  '![](attachements/img/image-20261107-091503.png)',
]

/** A note with an image pasted into it, saved in the folder and linked. */
function PastedImage() {
  return (
    <Shot>
      <Tabs>
        <Tab name="Trip.md" active />
      </Tabs>
      <div className="grid grid-cols-2 divide-x">
        <Code
          lines={PASTED}
          marks={{ 4: 'active' }}
          wrap
          format={(line) =>
            line.startsWith('![') ? (
              <Syn k="comment">{line}</Syn>
            ) : (
              markdownLine(line)
            )
          }
        />
        <div className="grid content-start gap-2 p-3">
          <span className="text-sm font-semibold tracking-tight">Trip</span>
          <span>The view from the top:</span>
          <div className="flex aspect-video items-center justify-center border bg-muted/40 text-muted-foreground">
            <IconPhoto className="size-6" stroke={1.5} />
          </div>
        </div>
      </div>
    </Shot>
  )
}

function ImageFiles() {
  return (
    <Shot>
      <Tabs>
        <Tab active name="image.png" />
      </Tabs>
      <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
        <span>{m.image_preview()} · 640 × 480</span>
        <span>{m.image_actual()}</span>
      </div>
      <div className="flex h-40 items-center justify-center bg-muted/20">
        <IconPhoto className="size-24 text-muted-foreground" stroke={1} />
      </div>
      <StatusBar>{m.file_download()}</StatusBar>
    </Shot>
  )
}

function MarkdownPdf() {
  return (
    <Shot>
      <Tabs>
        <Tab name="notes.md" active />
      </Tabs>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 p-5">
        <div className="grid gap-2 text-xs">
          <span className="flex items-center gap-2">
            <IconFolder className="size-4" />
            {m.explorer_new_folder()}
          </span>
          <span className="ml-4 font-mono text-muted-foreground">01.md</span>
          <span className="ml-4 font-mono text-muted-foreground">02.md</span>
        </div>
        <IconChevronRight className="size-4 text-muted-foreground" />
        <div className="border bg-background p-3">
          <div className="mb-3 text-xs font-medium">{m.md_preview()}</div>
          <Bar className="mb-2 w-3/4" />
          <Bar className="mb-3 w-full" />
          <div className="border">
            <Code lines={['const pdf = true']} format={(line) => line} />
          </div>
        </div>
      </div>
      <StatusBar>
        <IconDownload className="mx-1 size-3.5" />
        {m.md_pdf_folder()}
      </StatusBar>
    </Shot>
  )
}

function FileTitleAndLogo() {
  return (
    <BeforeAfter
      before={
        <>
          <StatusBar>
            <span className="size-4 rounded bg-foreground" />
            {site.name}
          </StatusBar>
          <Tabs>
            <Tab name="invoice.xml" active />
          </Tabs>
          <Code lines={ORDER} />
        </>
      }
      after={
        <>
          <StatusBar>
            <Logo className="size-4" />
            <span>invoice.xml | {site.name}</span>
          </StatusBar>
          <Tabs>
            <Tab name="invoice.xml" active />
          </Tabs>
          <Code lines={ORDER} />
        </>
      }
    />
  )
}

/** A printed page of a note: black like the dark theme, or white paper. Literal colours, as paper doesn't follow the theme. */
function PdfPage({ dark }: { dark?: boolean }) {
  const bar = cn('h-1.5', dark ? 'bg-neutral-700' : 'bg-neutral-200')
  return (
    <div className="p-5">
      <div
        className={cn(
          'mx-auto grid w-40 gap-2 border p-3 shadow-sm',
          dark
            ? 'border-neutral-800 bg-neutral-950 text-neutral-100'
            : 'border-neutral-200 bg-white text-neutral-900',
        )}
      >
        <span className="text-xs font-semibold tracking-tight">Release</span>
        <div className={cn(bar, 'w-full')} />
        <div className={cn(bar, 'w-3/4')} />
        <div
          className={cn(
            'border px-2 py-1 font-mono text-[10px]',
            dark
              ? 'border-neutral-800 text-neutral-400'
              : 'border-neutral-200 text-neutral-500',
          )}
        >
          const pdf = true
        </div>
      </div>
    </div>
  )
}

function LightPdf() {
  return <BeforeAfter before={<PdfPage dark />} after={<PdfPage />} />
}

const EMBEDDING = ['# Plan', '', 'Start from:', '', '![[Ideas]]']

/** A note embedding another, shown in place in the preview. */
function NoteEmbeds() {
  return (
    <Shot>
      <Tabs>
        <Tab name="Plan.md" active />
      </Tabs>
      <div className="grid grid-cols-2 divide-x">
        <Code lines={EMBEDDING} format={markdownLine} />
        <div className="grid content-start gap-2 p-3">
          <span className="text-sm font-semibold tracking-tight">Plan</span>
          <span>Start from:</span>
          <div className="grid gap-1.5 border-l-2 pl-3">
            <span className="text-[10px] text-muted-foreground">Ideas</span>
            <span className="font-semibold tracking-tight">Ideas</span>
            <Bar className="w-full" />
            <Bar className="w-2/3" />
          </div>
        </div>
      </div>
    </Shot>
  )
}

const meta = (text: string) => <Syn k="comment">{text}</Syn>

/** Markdown in the editor, faintly styled or formatted as the preview shows it. */
function MarkdownLines({ formatted }: { formatted?: boolean }) {
  const style = (className: string) => (formatted ? className : undefined)
  return (
    <Code
      lines={[
        <>
          {meta('# ')}
          <span
            className={cn(
              'font-semibold text-foreground',
              style('text-[1.5em] leading-none'),
            )}
          >
            Release
          </span>
        </>,
        '',
        <>
          Ships {meta('__')}
          <span className={formatted ? 'font-bold' : 'font-semibold'}>
            today
          </span>
          {meta('__')}, {meta('_')}
          <span className="italic">maybe</span>
          {meta('_')}.
        </>,
        <>
          Run {meta('`')}
          <span className={style('bg-(--hl-blue)/10 text-(--sql-keyword)')}>
            deploy
          </span>
          {meta('`')} and {meta('==')}
          <span className={style('bg-(--hl-amber)/30')}>check</span>
          {meta('==')}.
        </>,
      ]}
    />
  )
}

function FormattedMarkdown() {
  return (
    <BeforeAfter
      before={<MarkdownLines />}
      after={<MarkdownLines formatted />}
    />
  )
}

function FenceLines({ coloured }: { coloured?: boolean }) {
  const tone = (color: string, text: string) => (
    <span style={coloured ? { color } : undefined}>{text}</span>
  )
  return (
    <Code
      marks={coloured ? { 1: 'code', 2: 'code', 3: 'code', 4: 'code' } : {}}
      lines={[
        'Install it:',
        <>
          {meta('```')}
          {meta('ts')}
        </>,
        <>
          {tone('var(--sql-keyword)', 'const')} site{' '}
          {tone('var(--sql-operator)', '=')}{' '}
          {tone('var(--sql-function)', 'load')}(
          {tone('var(--sql-string)', "'docs'")})
        </>,
        <>{tone('var(--sql-comment)', '// ready')}</>,
        meta('```'),
      ]}
    />
  )
}

function ColouredFences() {
  return <BeforeAfter before={<FenceLines />} after={<FenceLines coloured />} />
}

function FormattedFence({ formatted }: { formatted?: boolean }) {
  const k = (text: string) => (
    <span style={{ color: 'var(--sql-keyword)' }}>{text}</span>
  )
  const str = (text: string) => (
    <span style={{ color: 'var(--sql-string)' }}>{text}</span>
  )
  const marks = formatted
    ? { 0: 'code', 1: 'code', 2: 'code', 3: 'code', 4: 'code', 5: 'code' }
    : { 0: 'code', 1: 'code', 2: 'code', 3: 'code' }
  return (
    <Code
      marks={marks as Partial<Record<number, 'code'>>}
      lines={
        formatted
          ? [
              meta('```ts'),
              <>
                {k('const')} test = {str('"123"')};
              </>,
              <>
                {k('function')} a() {'{'}
              </>,
              <>
                {'  '}
                {k('return')} test;
              </>,
              '}',
              meta('```'),
            ]
          : [
              meta('```ts'),
              <>
                {k('const')} test={str("'123'")}
              </>,
              <>
                {k('function')} a(){'{'}
                {k('return')} test{'}'}
              </>,
              meta('```'),
            ]
      }
      format={(line) => line}
    />
  )
}

function FormattedFences() {
  return (
    <BeforeAfter
      before={<FormattedFence />}
      after={<FormattedFence formatted />}
    />
  )
}

/** Markdown prose before and after Format, as Prettier and markdownlint lay it out. */
function FormattedProse() {
  const lines = (formatted?: boolean) =>
    formatted
      ? [
          meta('# Notes'),
          '',
          '- _one_',
          '- **two**',
          '',
          'See <https://example.com>',
        ]
      : [
          'Notes',
          meta('====='),
          '* *one*',
          '+ __two__',
          '',
          '',
          'See https://example.com   ',
        ]
  return (
    <BeforeAfter
      before={<Code lines={lines()} format={(line) => line} />}
      after={<Code lines={lines(true)} format={(line) => line} />}
    />
  )
}

function SettingsOnPlainFiles() {
  const bar = (settings?: boolean) => (
    <StatusBar className="border-t-0">
      <div className="flex-1" />
      <span className="flex items-center gap-1 px-1.5 text-foreground">
        <IconWand className="size-3.5" />
        {m.action_format()}
      </span>
      {settings && (
        <span className="flex items-center gap-1 px-1.5 text-foreground">
          <IconAdjustmentsHorizontal className="size-3.5" />
          {m.editor_settings()}
        </span>
      )}
      <span aria-hidden className="mx-1 h-4 w-px bg-border" />
      <span className="px-1.5">{m.md_pdf_export()}</span>
    </StatusBar>
  )
  return <BeforeAfter before={bar()} after={bar(true)} />
}

function SingleTilde({ struck }: { struck?: boolean }) {
  return (
    <Code
      lines={[
        <>
          {meta('~~')}
          <span className="line-through">gone</span>
          {meta('~~')}{' '}
          {struck ? (
            <>
              {meta('~')}
              <span className="line-through">gone</span>
              {meta('~')}
            </>
          ) : (
            '~gone~'
          )}
        </>,
      ]}
    />
  )
}

function SingleTildeStrike() {
  return <BeforeAfter before={<SingleTilde />} after={<SingleTilde struck />} />
}

function TableHelpers() {
  const cols = 6
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Shot className="h-40">
        <Code
          lines={['## Team', '', '/table']}
          format={(line) => line}
          marks={{ 2: 'active' }}
        />
        <div className="absolute top-20 left-10 grid gap-1.5 border bg-popover p-1.5">
          <div
            className="grid gap-0.5"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {Array.from({ length: cols * 3 }, (_, index) => (
              <span
                key={index}
                className={
                  index % cols < 3 && index < cols * 2
                    ? 'size-2.5 border border-foreground bg-foreground'
                    : 'size-2.5 border'
                }
              />
            ))}
          </div>
          <span className="text-center font-mono text-[10px] text-muted-foreground">
            {m.md_table_size({ cols: 3, rows: 2 })}
          </span>
        </div>
      </Shot>
      <Shot className="h-40">
        <Code
          className="pt-11"
          format={(line) => line}
          lines={[
            '| Name  | Role    |',
            meta('| ----- | ------- |'),
            '| Ada   | Eng     |',
            '| Grace | Admiral |',
          ]}
          marks={{ 2: 'active' }}
        />
        <div className="absolute top-2 left-8 flex items-center gap-1.5 border bg-popover px-2 py-1 text-[11px] whitespace-nowrap">
          <span className="flex items-center gap-0.5">
            <IconPlus className="size-3" />
            {m.md_table_row()}
          </span>
          <span className="flex items-center gap-0.5">
            <IconPlus className="size-3" />
            {m.md_table_column()}
          </span>
          <span aria-hidden className="h-3 w-px bg-border" />
          <IconAlignLeft className="size-3" />
          <IconAlignCenter className="size-3" />
          <IconAlignRight className="size-3" />
          <span aria-hidden className="h-3 w-px bg-border" />
          <span className="flex items-center gap-0.5">
            {m.md_table_delete()}
            <IconChevronDown className="size-3" />
          </span>
        </div>
      </Shot>
    </div>
  )
}

/** A Markdown table in the preview, from rules under rows to a full grid. */
function RuledTables() {
  const table = (ruled?: boolean) => {
    const cell = ruled
      ? 'border px-2 py-1 text-left'
      : 'border-b py-1 pr-2 text-left'
    return (
      <Shot className="p-4">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className={ruled ? 'bg-muted' : undefined}>
              <th className={cn(cell, 'font-medium')}>Name</th>
              <th className={cn(cell, 'font-medium')}>Role</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Ada', 'Eng'],
              ['Grace', 'Admiral'],
            ].map((row) => (
              <tr key={row[0]}>
                {row.map((value) => (
                  <td key={value} className={cell}>
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Shot>
    )
  }
  return <BeforeAfter before={table()} after={table(true)} />
}

/** Markdown tables, from a plain grid to a sheet with letters, numbers and stripes. */
function SheetTables() {
  const rows = [
    ['Ada', 'Eng'],
    ['Grace', 'Admiral'],
    ['Alan', 'Math'],
  ]
  const before = (
    <Shot className="p-4">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-muted">
            <th className="border px-2 py-1 text-left font-medium">Name</th>
            <th className="border px-2 py-1 text-left font-medium">Role</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((value) => (
                <td key={value} className="border px-2 py-1">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Shot>
  )
  const after = (
    <Shot className="p-4">
      <table className="md-table text-[11px]">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((value) => (
                <td key={value}>{value}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Shot>
  )
  return <BeforeAfter before={before} after={after} />
}

/** `` `code`{.colour} `` as typed, with the colours offered on `{`, and as previewed. */
function ColoredInlineCode() {
  const fade = (text: string) => (
    <span className="text-(--syntax-meta)">{text}</span>
  )
  const typed = (text: string, color: HighlightPreset) => (
    <>
      {fade('`')}
      <span className="md-code-color" style={codeColorStyle(color)}>
        {text}
      </span>
      {fade('`')}
      {fade(`{.${color}}`)}
    </>
  )
  const shown = (text: string, color: HighlightPreset) => (
    <code
      className="md-code-color px-[0.45em] py-[0.2em] font-mono text-[0.85em]"
      style={codeColorStyle(color)}
    >
      {text}
    </code>
  )
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Shot className="h-40">
        <Code
          format={(line) => line}
          marks={{ 2: 'active' }}
          lines={[
            <>Run {typed('deploy', 'red')},</>,
            <>then {typed('check', 'green')}.</>,
            <>
              Ship {fade('`')}
              <span className="md-code-color" style={codeColorStyle('blue')}>
                today
              </span>
              {fade('`{}')}
            </>,
          ]}
        />
        <ul className="absolute top-[4.25rem] left-[6.5rem] border bg-popover p-1 font-mono text-[11px] leading-6">
          {HIGHLIGHT_PRESETS.slice(0, 3).map((color, i) => (
            <li
              key={color}
              className={cn(
                'flex items-center px-2 text-muted-foreground',
                i === 1 && 'bg-secondary',
              )}
            >
              <span
                className="mr-2 size-2 rounded-full"
                style={{ backgroundColor: highlightCss(color) }}
              />
              <span className="text-foreground">{`{.${color}}`}</span>
              <span className="ml-4 font-sans">{colorLabel(color)}</span>
            </li>
          ))}
        </ul>
      </Shot>
      <Shot className="grid h-40 content-start gap-3 p-4 text-[13px]">
        <p>
          Run {shown('deploy', 'red')}, then {shown('check', 'green')}.
        </p>
        <p>Ship {shown('today', 'purple')}.</p>
      </Shot>
    </div>
  )
}

/** Coloured code as an HTML tag instead of `{.red}`, with the palette above it. */
function HtmlCodeColors() {
  const fade = (text: string) => (
    <span className="text-(--syntax-meta)">{text}</span>
  )
  const red = (text: string) => (
    <span className="md-code-color" style={codeColorStyle('red')}>
      {text}
    </span>
  )
  return (
    <BeforeAfter
      className="h-32"
      before={
        <Code
          format={(line) => line}
          lines={[
            '## Release',
            '',
            '',
            <>
              {fade('`')}
              {red('deploy')}
              {fade('`{.red}')} ships today.
            </>,
          ]}
        />
      }
      after={
        <>
          <Code
            wrap
            format={(line) => line}
            marks={{ 3: 'active' }}
            lines={[
              '## Release',
              '',
              '',
              <>
                {fade('<code style="color: red">')}
                {red('deploy')}
                {fade('</code>')} ships today.
              </>,
            ]}
          />
          <div className="absolute top-[2.125rem] left-8 border bg-popover">
            <CodeColorPicker value="red" onSelect={() => undefined} />
          </div>
        </>
      }
    />
  )
}

function HtmlCodeAsBackticks() {
  const fade = (text: string) => (
    <span className="text-(--syntax-meta)">{text}</span>
  )
  const red = (text: string) => (
    <span className="md-code-color" style={codeColorStyle('red')}>
      {text}
    </span>
  )
  const line = (open: string, close: string) => (
    <>
      Run {fade(open)}
      {red('deploy')}
      {fade(close)} today.
    </>
  )
  return (
    <BeforeAfter
      className="h-24"
      before={
        <Code
          format={(text) => text}
          lines={[
            '## Release',
            '',
            line('<code style="color: red">', '</code>'),
          ]}
        />
      }
      after={
        <Code
          format={(text) => text}
          lines={['## Release', '', line('`', '`')]}
        />
      }
    />
  )
}

function SqlColoursEverywhere() {
  return (
    <BeforeAfter
      before={
        <div className="syntax-greyscale">
          <Code lines={ORDER} />
        </div>
      }
      after={<Code lines={ORDER} />}
    />
  )
}

function CodeFonts() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {codeFonts
        .filter((font) => !('text' in font))
        .map((font) => (
          <Shot key={font.id} label={font.name}>
            <div style={{ [CODE_FONT_PROPERTY]: font.stack } as CSSProperties}>
              <Code lines={ORDER} />
            </div>
          </Shot>
        ))}
    </div>
  )
}

/** A note in source with the preview beside it, then live: rendered in place, the caret's line as written. */
function MarkdownLivePreview() {
  const lines = (live: boolean) => {
    const mark = (text: string) => (live ? null : meta(text))
    return [
      <>
        {mark('# ')}
        <span className="text-[1.5em] leading-none font-semibold text-foreground">
          Release
        </span>
      </>,
      <>
        {live ? <span className="text-muted-foreground">•</span> : meta('-')}{' '}
        Ships {mark('**')}
        <span className="font-bold">today</span>
        {mark('**')}
      </>,
      <>
        {live ? (
          <input
            type="checkbox"
            readOnly
            className="mr-1.5 align-[-0.1em] accent-foreground"
          />
        ) : (
          meta('- [ ] ')
        )}
        Run {mark('`')}
        <span className="bg-(--hl-blue)/10 text-(--sql-keyword)">deploy</span>
        {mark('`')}
      </>,
      <>
        See {meta('[')}
        <span className="underline underline-offset-2">notes</span>
        {meta('](./notes.md)')}
      </>,
    ]
  }
  const bar = (on: boolean) => (
    <StatusBar className="justify-end">
      <span
        className={cn(
          'inline-flex h-6 items-center gap-1 px-2',
          on && 'bg-muted text-foreground',
        )}
      >
        <IconEyeEdit className="size-3.5" />
        {m.md_live_toggle()}
      </span>
    </StatusBar>
  )
  return (
    <BeforeAfter
      before={
        <>
          <Code format={(text) => text} lines={lines(false)} />
          {bar(false)}
        </>
      }
      after={
        <>
          <Code
            format={(text) => text}
            lines={lines(true)}
            marks={{ 3: 'active' }}
          />
          {bar(true)}
        </>
      }
    />
  )
}

/** Live preview's code and tables: as written before, as a block and a grid after. */
function LiveCodeAndTables() {
  const MUTED = 'bg-foreground/4'
  return (
    <BeforeAfter
      before={
        <Code
          format={(text) => text}
          lines={[
            meta('```sql'),
            'select * from orders',
            meta('```'),
            '',
            <>
              {meta('| ')}Name{meta(' | ')}Qty{meta(' |')}
            </>,
            meta('| ---- | --: |'),
            <>
              {meta('| ')}Pen {meta(' | ')} 12{meta(' |')}
            </>,
          ]}
        />
      }
      after={
        <div className="grid gap-2 py-2 font-mono text-[11px] leading-5">
          <div className={cn('mx-0 border-y', MUTED)}>
            <div className="px-3 text-[0.85em] text-muted-foreground">sql</div>
            <div className="px-3 pb-1">
              <span className="text-(--sql-keyword)">select</span> * from orders
            </div>
          </div>
          <table className="mx-3 w-auto border-collapse">
            <thead>
              <tr>
                <th
                  className={cn('border px-2.5 text-left font-semibold', MUTED)}
                >
                  Name
                </th>
                <th
                  className={cn(
                    'border px-2.5 text-right font-semibold',
                    MUTED,
                  )}
                >
                  Qty
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-2.5 shadow-[inset_0_0_0_1px_var(--ring)]">
                  Pen
                </td>
                <td className="border px-2.5 text-right">12</td>
              </tr>
            </tbody>
          </table>
        </div>
      }
    />
  )
}

/** A live preview table: cells as written before, drawn as they read after. */
function LiveTableCells() {
  const MUTED = 'bg-foreground/4'
  const grid = (cells: [ReactNode, ReactNode]) => (
    <table className="m-3 w-auto border-collapse font-mono text-[11px] leading-5 whitespace-nowrap">
      <thead>
        <tr>
          <th className={cn('border px-2.5 text-left font-semibold', MUTED)}>
            Task
          </th>
          <th className={cn('border px-2.5 text-left font-semibold', MUTED)}>
            Notes
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="border px-2.5">{cells[0]}</td>
          <td className="border px-2.5">{cells[1]}</td>
        </tr>
      </tbody>
    </table>
  )
  return (
    <BeforeAfter
      before={grid(['**Ship** it', 'Run `deploy` on ==Friday=='])}
      after={grid([
        <>
          <strong>Ship</strong> it
        </>,
        <>
          Run{' '}
          <span className="bg-(--hl-blue)/10 text-(--sql-keyword)">deploy</span>{' '}
          on <span className="bg-(--hl-amber)/30">Friday</span>
        </>,
      ])}
    />
  )
}

function SharedLinkRequest({ name }: { name: string }) {
  return (
    <>
      <StatusBar className="border-t-0 border-b bg-muted/60">
        <IconShare className="size-3" />
        <span className="font-mono">order-2.xml</span>
      </StatusBar>
      <div className="grid gap-3 p-4">
        <p className="font-medium">{m.share_open_title({ name })}</p>
        <p className="text-muted-foreground">{m.share_open_description()}</p>
        <div className="flex justify-end">
          <Button size="sm">{m.share_open_confirm()}</Button>
        </div>
      </div>
    </>
  )
}

function LatestSharedLink() {
  return (
    <BeforeAfter
      before={<SharedLinkRequest name="order-1.xml" />}
      after={<SharedLinkRequest name="order-2.xml" />}
    />
  )
}

function FileMovePreview({ feedback = false }: { feedback?: boolean }) {
  const view = (moved: boolean) => (
    <div className="p-3 text-xs">
      <div className="flex items-center gap-2">
        <IconFolderRoot className="size-4" />
        {m.folder_on_device()}
      </div>
      {(!moved || feedback) && (
        <div
          className={cn(
            'ml-6 py-2 font-mono',
            feedback && moved && 'opacity-40',
          )}
        >
          notes.xml
        </div>
      )}
      <div
        className={cn(
          'ml-3 border-l p-2',
          feedback &&
            moved &&
            'bg-muted/60 outline outline-1 -outline-offset-1 outline-foreground/50',
        )}
      >
        <div className="flex items-center gap-2">
          <IconFolder className="size-4" />
          {m.explorer_new_folder()}
        </div>
        {moved && <div className="ml-6 bg-muted p-2 font-mono">notes.xml</div>}
      </div>
      <StatusBar>{m.explorer_move()}</StatusBar>
    </div>
  )
  return <BeforeAfter before={view(false)} after={view(true)} />
}

function DragFeedbackPreview() {
  return <FileMovePreview feedback />
}

const PLAIN_NOTES = [
  '# Notes',
  '',
  'Ship the label fix on Friday.',
  '- Check printer DPI',
]

function PlainGutters({ trimmed }: { trimmed?: boolean }) {
  return (
    <>
      <Tabs>
        <Tab name="notes.md" active />
      </Tabs>
      <Code
        lines={PLAIN_NOTES.map((line) => (
          <>
            {!trimmed && <span className="inline-block w-7" />}
            {line}
          </>
        ))}
      />
    </>
  )
}

function PlainFileGutters() {
  return (
    <BeforeAfter before={<PlainGutters />} after={<PlainGutters trimmed />} />
  )
}

const FENCE_ROWS: Array<[number, 'text' | 'open' | 'code' | 'close', string]> =
  [
    [1, 'text', 'Notes'],
    [2, 'text', ''],
    [3, 'open', 'js'],
    [4, 'code', "const total = '128.00'"],
    [5, 'close', ''],
  ]

function FenceGutter({ numbered }: { numbered?: boolean }) {
  return (
    <>
      <Tabs>
        <Tab name="notes.md" active />
      </Tabs>
      <div className="py-2 font-mono text-[11px] leading-5">
        {FENCE_ROWS.map(([n, kind, text]) => {
          const fence = kind === 'open' || kind === 'close'
          const tall = numbered || kind === 'open'
          return (
            <div
              key={n}
              className={cn(
                'flex pr-3',
                kind !== 'text' && 'bg-foreground/4',
                kind === 'open' && 'shadow-[inset_0_1px_0_var(--border)]',
                kind === 'close' && 'shadow-[inset_0_-1px_0_var(--border)]',
                !tall && 'h-1.5',
              )}
            >
              <span className="w-8 shrink-0 pr-3 text-right text-(--syntax-gutter)">
                {(!fence || numbered) && n}
              </span>
              <span
                className={cn(
                  'whitespace-pre',
                  kind === 'open' && 'text-muted-foreground',
                )}
              >
                {text}
              </span>
            </div>
          )
        })}
      </div>
    </>
  )
}

function FenceGutterPreview() {
  return (
    <BeforeAfter before={<FenceGutter />} after={<FenceGutter numbered />} />
  )
}

/** A line of live preview, its inline code bare or padded like the preview's. */
function LiveInlineCode({ padded = false }: { padded?: boolean }) {
  return (
    <div className="p-3 font-mono">
      Run{' '}
      <span
        className={
          padded ? 'md-inline-code' : 'bg-(--hl-blue)/10 text-(--sql-keyword)'
        }
      >
        deploy
      </span>{' '}
      now.
    </div>
  )
}

function LiveInlineCodePreview() {
  return (
    <BeforeAfter
      before={<LiveInlineCode />}
      after={<LiveInlineCode padded />}
    />
  )
}

/** Markdown's text in Times New Roman, its inline code and fence still monospace. */
function SerifText() {
  const times = codeFonts.find((font) => font.id === 'times-new-roman')!
  return (
    <Shot label={times.name}>
      <div
        className="grid gap-2 p-3 text-sm"
        style={{ fontFamily: times.text }}
      >
        <p className="text-base font-semibold">Release notes</p>
        <p>
          Run <span className="md-inline-code">deploy</span> once the checks
          pass.
        </p>
        <div className="border bg-muted/40">
          <Code lines={ORDER} />
        </div>
      </div>
    </Shot>
  )
}

export const previews: Record<string, ComponentType> = {
  '1.42.0': figure(SerifText),
  '1.41.0': figure(SheetTables),
  '1.40.2': figure(LiveInlineCodePreview),
  '1.40.1': figure(FenceGutterPreview),
  '1.40.0': figure(DragFeedbackPreview),
  '1.39.1': figure(PlainFileGutters),
  '1.39.0': figure(FileMovePreview),
  '1.38.1': figure(LatestSharedLink),
  '1.38.0': figure(ClosedTabsKept),
  '1.37.0': figure(LiveTableCells),
  '1.36.0': figure(LiveCodeAndTables),
  '1.35.0': figure(MarkdownLivePreview),
  '1.34.0': figure(HtmlCodeAsBackticks),
  '1.33.0': figure(HtmlCodeColors),
  '1.32.0': figure(ColoredInlineCode),
  '1.31.0': figure(RevealActiveTab),
  '1.30.0': figure(CodeFonts),
  '1.29.0': figure(SqlColoursEverywhere),
  '1.28.0': figure(RuledTables),
  '1.27.0': figure(TableHelpers),
  '1.26.0': figure(SingleTildeStrike),
  '1.25.0': figure(FormattedProse),
  '1.24.0': figure(SettingsOnPlainFiles),
  '1.23.0': figure(FormattedFences),
  '1.22.1': figure(ColouredFences),
  '1.22.0': figure(ColouredFences),
  '1.21.0': figure(FormattedMarkdown),
  '1.20.0': figure(NoteEmbeds),
  '1.19.1': figure(LightPdf),
  '1.19.0': figure(DraftEditor),
  '1.18.1': figure(FileTitleAndLogo),
  '1.18.0': figure(PasteBar),
  '1.17.0': figure(FileTitleAndLogo),
  '1.16.0': figure(MarkdownPdf),
  '1.15.0': figure(ImageFiles),
  '1.14.0': figure(UnsupportedFiles),
  '1.13.1': figure(SquareCode),
  '1.13.0': figure(PastedImage),
  '1.12.1': figure(PaddedCode),
  '1.12.0': figure(BlueCode),
  '1.11.1': figure(QuietCode),
  '1.11.0': figure(CodeBlockFrame),
  '1.10.0': figure(ObsidianVault),
  '1.9.0': figure(ExplorerNewMenu),
  '1.8.1': figure(ExplorerHints),
  '1.8.0': figure(FolderWorkspaces),
  '1.7.2': figure(ExplorerHover),
  '1.6.2': figure(HeaderWithoutRepeat),
  '1.6.0': figure(RenamedSite),
  '1.7.0': figure(ExplorerPreview),
  '1.5.0': figure(PlainTextFile),
  '1.4.0': figure(MarkdownPreview),
  '1.3.0': figure(DollarWrappedVars),
  '1.2.0': figure(PinTagGoTo),
  '1.1.0': figure(ProblemLanguage),
  '0.190.0': figure(PinOccurrenceRepeated),
  '0.189.0': figure(PinOccurrenceDiff),
  '0.188.0': figure(PinOccurrenceRail),
  '0.187.0': figure(FlatRecordsRuled),
  '0.186.0': figure(FlatRecordsBelow),
  '0.185.0': figure(PinOccurrenceRevert),
  '0.184.0': figure(PinOccurrenceList),
  '0.183.0': figure(PinOccurrences),
  '0.182.0': figure(NoticeSlot),
  '0.181.0': figure(BottomBarMenus),
  '0.180.0': figure(BottomBarOverflow),
  '0.179.0': figure(PinTagChipClick),
  '0.178.0': figure(PinTagChipStart),
  '0.177.0': figure(PinTagChips),
  '0.176.0': figure(PinCopyNames),
  '0.175.0': figure(ZplCentered),
  '0.174.0': figure(ZplQuietStatus),
  '0.173.0': figure(PaneButtonPlaces),
  '0.172.0': figure(ClosePane),
  '0.171.1': figure(ZplTabSheet),
  '0.171.0': figure(WordWrap),
  '0.170.2': figure(TabClickOutline),
  '0.170.1': figure(TabFocusRing),
  '0.170.0': figure(CardTabs),
  '0.169.0': figure(ZplOneBar),
  '0.168.0': figure(ZplPreviewOnTop),
  '0.167.2': figure(ZplLoneToolbar),
  '0.167.1': figure(ZplSideBySide),
  '0.167.0': figure(PaneTabs),
  '0.166.0': figure(ZplWorkspace),
  '0.165.1': figure(ChangeTypeEmpty),
  '0.164.1': figure(PrefixedPins),
  '0.164.0': figure(FoldedNotes),
  '0.163.0': figure(ReleasePictures),
  '0.162.0': figure(SqlColours),
  '0.161.0': figure(SqlFormat),
  '0.160.0': figure(AboutGrid),
  '0.159.2': figure(Showcase),
  '0.159.0': figure(ChangeType),
  '0.158.1': figure(PasteTemplate),
  '0.158.0': figure(PasteDialog, EmptyFile),
  '0.157.0': figure(FlatFiles),
  '0.156.1': figure(TabCompletion),
  '0.156.0': figure(AbsentHighlights),
  '0.155.0': figure(Tooltips),
  '0.154.1': figure(Alignment),
  '0.154.0': figure(WelcomeSnippet),
  '0.153.0': figure(WelcomeRestored),
  '0.152.0': figure(WelcomeSimple),
  '0.151.0': figure(EarlierReleases),
  '0.150.0': figure(ChangelogRows),
  '0.149.0': figure(AutoProfile),
  '0.148.0': figure(ChangelogLink),
  '0.147.0': figure(VersionInBar),
  '0.146.0': figure(LabelledSwitches),
  '0.127.0': figure(BrowserTabs, GreyscaleSyntax),
  '0.98.0': figure(SortOrder),
  '0.84.0': figure(CompareTabs),
  '0.31.0': figure(FirstEditor),
}
