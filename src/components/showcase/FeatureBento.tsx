import {
  IconArrowRight,
  IconChevronDown,
  IconFileCode,
} from '@tabler/icons-react'
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'

import { Icon } from './kit/parts/Icon'
import { Roll } from './kit/motion/Roll'
import { States } from './kit/motion/States'
import { Stage } from './kit/stage'
import { Bar, Window } from './kit/window'
import type { Act } from './kit/act'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import './feature-bento.css'

// The editor's features as a ruled bento (stageshow's references/bento.md).
//
//   Tile        Span   Kind        The one thing                       Moves
//   Sync        2 × 1  Hero UI     status edited in the tree           the value rolls, then its code line
//   Local       1 × 1  Stat        "0 bytes" sent to a server          holds still
//   Compare     1 × 1  Component   one changed price in a diff         the changed text marks in
//   Highlights  1 × 1  Collection  tag chips, a few of them coloured   the coloured ones tint in
//   Share       1 × 1  Component   the share dialog's Copy link        the button turns Copied
//
// One window in the grid (the hero's). Each picture is its own Stage at 1:1,
// sized to the slot under its copy and cropped by the cell; the copy is page
// text. Each tile plays one beat, once, as it scrolls in, 110ms after the one
// before it in reading order.

const STEP = 110
const LEAD = 450

type Beat = { on: boolean }
const before: Beat = { on: false }
const after: Beat = { on: true }
const beat = (i: number) => async (a: Act<Beat>) => {
  await a.wait(LEAD + i * STEP)
  await a.set({ on: true })
}

// The page's own theme: `.dark` on <html>, toggled by the header switch.
function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  return () => observer.disconnect()
}
function useDark() {
  return useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.classList.contains('dark'),
    () => false,
  )
}

// The cell owns the crop: the Stage takes the slot's measured size, so a
// picture is never cut short of the cell edge or scaled.
function useSlotSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () =>
      setSize({ width: node.clientWidth, height: node.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return [ref, size] as const
}

function Picture({
  index,
  children,
}: {
  index: number
  children: (on: boolean, width: number) => ReactNode
}) {
  const [ref, { width, height }] = useSlotSize()
  const dark = useDark()
  return (
    <div ref={ref} className="relative min-h-0 flex-1" aria-hidden>
      {width > 0 && height > 0 && (
        <Stage<Beat>
          width={width}
          height={height}
          initial={before}
          poster={after}
          play="once"
          script={beat(index)}
          theme={dark ? 'dark' : 'light'}
          className="xb-stage"
        >
          {(s) => children(s.on, width)}
        </Stage>
      )}
    </div>
  )
}

function Cell({
  title,
  body,
  className,
  children,
}: {
  title: string
  body: string
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'relative flex h-80 flex-col overflow-hidden bg-background',
        className,
      )}
    >
      <p className="relative z-1 max-w-[30rem] px-6 pt-6 text-[17px] leading-6 tracking-[-0.012em] text-pretty text-muted-foreground @[600px]:px-7">
        <b className="font-semibold text-foreground">{title}</b> {body}
      </p>
      {children}
    </div>
  )
}

/* ---------------- XML lines ---------------- */

type Tone = 'tag' | 'attr' | 'value' | 'punct'

// A light XML tokenizer for a single line: tag and attribute names, quoted
// values, text and punctuation, coloured with the editor's syntax tokens.
function xml(line: string): ReactNode[] {
  const out: ReactNode[] = []
  const push = (tone: Tone, text: string) =>
    out.push(
      <span key={out.length} className={`xb-${tone}`}>
        {text}
      </span>,
    )
  let rest = line
  let inTag = false
  let named = false
  while (rest) {
    const match = inTag
      ? /^(\s+)|^(\/?>)|^(=)|^("[^"]*")|^([^\s=/>]+)/.exec(rest)
      : /^(<\/?)|^([^<]+)/.exec(rest)
    if (!match) break
    const [text] = match
    if (inTag) {
      if (match[1]) out.push(text)
      else if (match[2]) {
        push('punct', text)
        inTag = false
      } else if (match[3]) push('punct', text)
      else if (match[4]) push('value', text)
      else {
        push(named ? 'attr' : 'tag', text)
        named = true
      }
    } else if (match[1]) {
      push('punct', text)
      inTag = true
      named = false
    } else push('value', text)
    rest = rest.slice(text.length)
  }
  return out
}

/* ---------------- Sync (hero) ---------------- */

const CODE = [
  '<order id="4821">',
  '  <customer>Maya Chen</customer>',
  null, // the status line, which rolls
  '  <placed>2026-10-30</placed>',
  '  <items>',
  '    <item sku="A-102">Notebook</item>',
  '    <item sku="B-317">Pen set</item>',
  '    <item sku="C-040">Folder</item>',
  '  </items>',
  '  <total currency="CAD">128.00</total>',
  '</order>',
]

function TreeRow({
  depth,
  open,
  name,
  attrs,
  children,
  selected,
}: {
  depth: number
  open?: boolean
  name: string
  attrs?: [string, string][]
  children?: ReactNode
  selected?: boolean
}) {
  return (
    <div
      className="xb-tree-row"
      data-selected={selected || undefined}
      style={{ paddingLeft: 8 + depth * 16 }}
    >
      <span className="xb-twisty">
        {open && <IconChevronDown size={12} stroke={1.75} />}
      </span>
      <span className="xb-tag">{name}</span>
      {attrs?.map(([key, value]) => (
        <span key={key} className="xb-attr-pair">
          <span className="xb-attr">{key}</span>
          <span className="xb-punct">=</span>
          <span className="xb-value">{value}</span>
        </span>
      ))}
      {children && <span className="xb-leaf">{children}</span>}
    </div>
  )
}

function Sync() {
  return (
    <Cell
      title={m.showcase_sync_title()}
      body={m.showcase_sync_body()}
      className="h-100 @[600px]:col-span-2 @[600px]:h-95"
    >
      <Picture index={0}>
        {(on, width) => {
          const status = on ? 'shipped' : 'pending'
          const compact = width < 560
          const code = (
            <div className="xb-code">
              {CODE.map((line, i) => (
                <div
                  key={i}
                  className="xb-line"
                  data-active={(line === null && on) || undefined}
                >
                  <span className="xb-gutter">{i + 1}</span>
                  <span className="xb-text">
                    {line === null ? (
                      <>
                        {'  '}
                        {xml('<status>')}
                        <span className="xb-value">
                          <Roll delay={320}>{status}</Roll>
                        </span>
                        {xml('</status>')}
                      </>
                    ) : (
                      xml(line)
                    )}
                  </span>
                </div>
              ))}
            </div>
          )
          const tree = (
            <div className="xb-structure">
              <div className="xb-structure-head">
                {m.panel_structure()}
                <Bar w={112} h={6} tone={2} />
              </div>
              <TreeRow depth={0} open name="order" attrs={[['id', '4821']]} />
              <TreeRow depth={1} name="customer">
                Maya Chen
              </TreeRow>
              <TreeRow depth={1} name="status" selected>
                <span className="xb-edit">
                  <Roll>{status}</Roll>
                  <span className="xb-caret" data-on={on || undefined} />
                </span>
              </TreeRow>
              <TreeRow depth={1} name="placed">
                2026-10-30
              </TreeRow>
              <TreeRow depth={1} open name="items" />
              <TreeRow depth={2} name="item" attrs={[['sku', 'A-102']]}>
                Notebook
              </TreeRow>
              <TreeRow depth={2} name="item" attrs={[['sku', 'B-317']]}>
                Pen set
              </TreeRow>
              <TreeRow depth={2} name="item" attrs={[['sku', 'C-040']]}>
                Folder
              </TreeRow>
              <TreeRow depth={1} name="total" attrs={[['currency', 'CAD']]}>
                128.00
              </TreeRow>
            </div>
          )
          return (
            <Window
              title="order.xml"
              className="xb-window"
              data-layout={compact ? 'compact' : 'wide'}
              body={{ className: 'xb-panes' }}
            >
              {code}
              {tree}
            </Window>
          )
        }}
      </Picture>
    </Cell>
  )
}

/* ---------------- Local (stat) ---------------- */

function Local() {
  // "0 bytes" splits into its figure and its unit, which sit on one line.
  const [figure, ...unit] = m.showcase_local_value().split(' ')
  return (
    <div className="relative flex h-65 flex-col justify-between overflow-hidden bg-foreground px-6 pt-6 pb-7 text-background @[600px]:h-80 @[600px]:px-7 @[900px]:h-95">
      <span className="text-[17px] leading-6 font-semibold tracking-[-0.012em]">
        {m.showcase_local_lead()}
      </span>
      <span>
        <span className="block text-[76px] leading-none font-semibold tracking-[-0.04em] whitespace-nowrap tabular-nums">
          {figure}
          <span className="text-[40px] tracking-[-0.025em]">
            {' '}
            {unit.join(' ')}
          </span>
        </span>
        <span className="mt-3 block max-w-60 text-[15px] leading-[21px] text-pretty text-background/60">
          {m.showcase_local_body()}
        </span>
      </span>
    </div>
  )
}

/* ---------------- Compare (component) ---------------- */

const DIFF: { text: string; kind?: 'del' | 'add'; mark?: string }[] = [
  { text: '<product id="88">' },
  { text: '  <name>Desk lamp</name>' },
  { text: '  <price>34.00</price>', kind: 'del', mark: '34.00' },
  { text: '  <price>29.00</price>', kind: 'add', mark: '29.00' },
  { text: '  <stock>12</stock>' },
  { text: '</product>' },
  { text: '<product id="89">' },
  { text: '  <name>Floor lamp</name>' },
  { text: '  <price>78.00</price>' },
]

function DiffLine({
  text,
  mark,
  on,
}: {
  text: string
  mark?: string
  on: boolean
}) {
  if (!mark) return <>{xml(text)}</>
  const [head, tail] = text.split(mark)
  return (
    <>
      {xml(head)}
      <span className="xb-value xb-changed" data-on={on || undefined}>
        {mark}
      </span>
      {xml(tail)}
    </>
  )
}

function Compare() {
  return (
    <Cell title={m.showcase_compare_title()} body={m.showcase_compare_body()}>
      <Picture index={2}>
        {(on) => (
          <div className="xb-diff">
            <div className="xb-diff-head">
              <IconFileCode size={14} stroke={1.5} />
              <span>catalog-v1.xml</span>
              <IconArrowRight size={12} stroke={1.5} />
              <span className="xb-diff-b">catalog-v2.xml</span>
            </div>
            <div className="xb-code">
              {DIFF.map((line, i) => (
                <div key={i} className="xb-line" data-kind={line.kind}>
                  <span className="xb-gutter">
                    {line.kind === 'del' ? '−' : line.kind === 'add' ? '+' : ''}
                  </span>
                  <span className="xb-text">
                    <DiffLine text={line.text} mark={line.mark} on={on} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Picture>
    </Cell>
  )
}

/* ---------------- Highlights (collection) ---------------- */

// Rows of tag chips running off both sides. Only the coloured tags carry
// words, whole and inside the crop; the plain ones are the rest of the
// document, drawn as placeholders of their names' length.
const CHIPS: { name: string; hl?: string }[][] = [
  [
    { name: 'issueDate' },
    { name: 'invoice', hl: 'blue' },
    { name: 'paymentTerms' },
    { name: 'buyer' },
  ],
  [
    { name: 'lineItem', hl: 'amber' },
    { name: 'quantity' },
    { name: 'netTotal' },
    { name: 'taxAmount' },
  ],
  [
    { name: 'reference' },
    { name: 'dueDate', hl: 'teal' },
    { name: 'iban', hl: 'purple' },
    { name: 'shipTo' },
  ],
  [
    { name: 'notes' },
    { name: 'discount', hl: 'red' },
    { name: 'vatId' },
    { name: 'currency' },
  ],
  [
    { name: 'sellerName' },
    { name: 'supplier', hl: 'green' },
    { name: 'amount' },
    { name: 'country' },
  ],
  [{ name: 'taxRate' }, { name: 'unitPrice' }, { name: 'postcode' }],
  [{ name: 'region' }, { name: 'contact' }, { name: 'orderRef' }],
]

/** Coloured chips light up one after another, in reading order. */
const CHIP_DELAYS = new Map(
  CHIPS.flat()
    .filter((chip) => chip.hl)
    .map((chip, i) => [chip, `${i * 90}ms`]),
)

function Highlights() {
  return (
    <Cell
      title={m.showcase_highlights_title()}
      body={m.showcase_highlights_body()}
    >
      <Picture index={3}>
        {(on) => (
          <div className="xb-chips">
            {CHIPS.map((row, r) => (
              <div key={r} className="xb-chip-row" data-row={r}>
                {row.map((chip) => (
                  <span
                    key={chip.name}
                    className="xb-chip"
                    data-on={(chip.hl && on) || undefined}
                    style={
                      chip.hl
                        ? {
                            ['--hl' as string]: `var(--hl-${chip.hl})`,
                            transitionDelay: CHIP_DELAYS.get(chip),
                          }
                        : undefined
                    }
                  >
                    {chip.hl ? (
                      chip.name
                    ) : (
                      <Bar w={chip.name.length * 6} h={6} tone={3} />
                    )}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </Picture>
    </Cell>
  )
}

/* ---------------- Share (component) ---------------- */

function Switch({ on }: { on: boolean }) {
  return <span className="xb-switch" data-on={on || undefined} />
}

function Share() {
  return (
    <Cell title={m.showcase_share_title()} body={m.showcase_share_body()}>
      <Picture index={4}>
        {(on) => (
          <div className="xb-dialog">
            <div className="xb-dialog-copy">
              <Bar w={132} h={8} tone={4} />
              <Bar w="86%" h={6} tone={2} />
            </div>
            <div className="xb-option">
              <span>{m.share_include_profile()}</span>
              <Switch on />
            </div>
            <div className="xb-option">
              <Bar w={118} h={6} tone={3} />
              <Switch on={false} />
            </div>
            <div className="xb-link">
              xml.puuid.com/#share=eNqNkMFqwzAMhl9F6NxD0mZt6W1sl8EGg-
            </div>
            <div className="xb-actions">
              <span className="xb-button">{m.cancel()}</span>
              <span
                className="xb-button xb-button--primary"
                data-on={on || undefined}
              >
                <States
                  value={on ? 'done' : 'ask'}
                  states={{
                    ask: m.share_copy_confirm(),
                    done: (
                      <>
                        <Icon name="check" size={14} />
                        {m.showcase_share_copied()}
                      </>
                    ),
                  }}
                />
              </span>
            </div>
            <div className="xb-dialog-foot">
              <Bar w="72%" h={6} tone={2} />
            </div>
          </div>
        )}
      </Picture>
    </Cell>
  )
}

/** The editor's main features as a ruled grid of small product pictures. */
export function FeatureBento({ className }: { className?: string }) {
  return (
    <section
      aria-label={m.showcase_label()}
      className={cn('xb @container', className)}
    >
      <div className="grid grid-cols-1 gap-px border bg-border @[600px]:grid-cols-2 @[900px]:grid-cols-3">
        <Sync />
        <Local />
        <Compare />
        <Highlights />
        <Share />
      </div>
    </section>
  )
}
