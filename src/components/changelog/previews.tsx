import {
  IconAdjustmentsHorizontal,
  IconBraces,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconDots,
  IconFileCode,
  IconFileDots,
  IconFilePlus,
  IconFolderOpen,
  IconJson,
  IconLayoutColumns,
  IconLayoutSidebarRight,
  IconPin,
  IconReplace,
  IconShare,
  IconTextWrap,
  IconUserCircle,
  IconVariable,
  IconWand,
} from '@tabler/icons-react'
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
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Kbd } from '#/components/ui/kbd'
import { Switch } from '#/components/ui/switch'
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
      before={<Code lines={sql(QUERY, 'grey')} />}
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
  const rows = FLAT.slice(1).map((line) => line.split('|').slice(1))
  return (
    <Shot className="grid sm:grid-cols-[1fr_1fr]">
      <Code lines={FLAT} format={flat} marks={{ 2: 'active' }} />
      <div className="border-t bg-muted/20 sm:border-t-0 sm:border-l">
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
                <th key={h} className="px-3 py-1 text-left font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, r) => (
              <tr key={r} className={cn('border-b', r === 1 && 'bg-muted')}>
                <td className="px-3 py-1 text-muted-foreground">{r + 2}</td>
                {cells.map((cell, c) => (
                  <td
                    key={c}
                    className={cn(
                      'px-3 py-1',
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
    </Shot>
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
      after={<Code lines={ORDER} />}
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

export const previews: Record<string, ComponentType> = {
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
