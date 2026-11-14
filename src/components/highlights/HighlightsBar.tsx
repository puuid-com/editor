import { IconChevronUp, IconTrash } from '@tabler/icons-react'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'

import { colorLabel } from './color-label'
import { ColorSwatches } from './ColorSwatches'
import { hlStyle } from './hl-style'
import { SwatchMenuRow } from './SwatchMenuRow'
import { MatchNavItems, TagMenuHeader } from './TagMenuItems'
import { cycleTag } from '#/components/editor/actions'
import { Button } from '#/components/ui/button'
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '#/components/ui/context-menu'
import { Input } from '#/components/ui/input'
import { Kbd } from '#/components/ui/kbd'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '#/components/ui/popover'
import { useHighlightSwatches, useHighlights } from '#/hooks/use-highlights'
import { useTagCounts } from '#/hooks/use-tag-counts'
import { localName } from '#/lib/names'
import { shortcutLabel, shortcuts } from '#/lib/shortcuts'
import {
  groupByColor,
  highlightCss,
  nextPreset,
  recolorGroup,
  removeHighlight,
  setGroupEnabled,
  setHighlight,
  toggleHighlight,
} from '#/lib/store/highlights'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import type { Highlight } from '#/lib/store/highlights'

/**
 * The bottom bar's highlights: one button, with a dot per colour and the
 * match total, that opens the legend. Rules sharing a colour sit in one pill;
 * each tag in it cycles through its matches. Rules with no match in the file
 * are listed under it, then the form to add one.
 */
export function HighlightsBar() {
  const rules = useHighlights()
  const [open, setOpen] = useState(false)
  // With no rules, only the open legend's suggestions need the counts.
  const counts = useTagCounts(open || rules.length > 0)
  const countOf = (rule: Highlight) => counts.get(localName(rule.tag)) ?? 0
  const present = rules.filter((r) => countOf(r) > 0)
  const absent = rules.filter((r) => countOf(r) === 0)
  const groups = groupByColor(present)
  const total = present.reduce((sum, r) => sum + countOf(r), 0)

  return (
    <div className="contents">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="xs"
            className="shrink-0 gap-1.5 px-1.5 text-[11px] font-normal text-foreground max-md:h-11"
            aria-label={m.highlights_title()}
          >
            {groups.length > 0 && (
              <span aria-hidden className="flex -space-x-0.5">
                {groups.slice(0, 6).map((group) => (
                  <span
                    key={group[0].id}
                    style={hlStyle(highlightCss(group[0].color))}
                    className="size-2 rounded-full bg-(--hl) ring-1 ring-background"
                  />
                ))}
              </span>
            )}
            {m.highlights_title()}
            {total > 0 && (
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                {total}
              </span>
            )}
            <IconChevronUp className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          className="w-80 max-w-[calc(100vw-1rem)]"
        >
          <PopoverHeader>
            <PopoverTitle>{m.highlights_title()}</PopoverTitle>
            <PopoverDescription>
              {m.highlights_description()}
            </PopoverDescription>
          </PopoverHeader>
          {groups.length > 0 && (
            <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
              {groups.map((group) => (
                <ColorGroup key={group[0].id} rules={group} countOf={countOf} />
              ))}
            </div>
          )}
          {absent.length > 0 && <AbsentRules rules={absent} />}
          <AddRuleForm
            tagNames={[...counts.keys()].sort()}
            existing={rules.map((r) => localName(r.tag))}
          />
        </PopoverContent>
      </Popover>
      {rules.length === 0 && (
        <span className="ml-1 hidden min-w-0 truncate text-muted-foreground lg:inline">
          {m.highlights_hint_prefix()}{' '}
          <Kbd>{shortcutLabel(shortcuts.highlight)}</Kbd>{' '}
          {m.highlights_hint_suffix()}
        </span>
      )}
    </div>
  )
}

function ColorGroup({
  rules,
  countOf,
}: {
  rules: Array<Highlight>
  countOf: (rule: Highlight) => number
}) {
  const { color } = rules[0]
  const anyOn = rules.some((r) => r.enabled)
  const total = rules.reduce((sum, r) => sum + countOf(r), 0)
  return (
    <div
      role="group"
      aria-label={m.highlight_group({ color: colorLabel(color) })}
      className="flex shrink-0 items-center gap-1.5"
    >
      <div
        style={hlStyle(highlightCss(color))}
        className={cn(
          'flex items-stretch overflow-hidden',
          anyOn ? 'hl-tag' : 'rounded-[3px] ring-1 ring-(--hl)',
        )}
      >
        {rules.map((rule) => (
          <RuleSegment
            key={rule.id}
            rule={rule}
            count={countOf(rule)}
            group={rules}
          />
        ))}
      </div>
      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
        {total}
      </span>
    </div>
  )
}

function RuleSegment({
  rule,
  count,
  group,
}: {
  rule: Highlight
  count: number
  group: Array<Highlight>
}) {
  const colors = useHighlightSwatches()
  const allOn = group.every((r) => r.enabled)
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => cycleTag(rule.tag)}
          aria-label={`${rule.tag}, ${m.highlight_matches({ count })}`}
          className={cn(
            'h-11 min-w-11 px-1.5 font-mono text-[11px] font-normal not-first:border-l not-first:border-(--hl)/35 hover:bg-(--hl)/15 data-[state=open]:bg-(--hl)/20 md:h-5 md:min-w-0 dark:hover:bg-(--hl)/20',
            rule.enabled ? 'hl-ink' : 'text-muted-foreground line-through',
          )}
        >
          {rule.tag}
        </Button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-72">
        <TagMenuHeader tag={rule.tag} />
        <ContextMenuCheckboxItem
          checked={rule.enabled}
          onCheckedChange={() => toggleHighlight(rule.id)}
        >
          {m.highlight_show()}
        </ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <MatchNavItems tag={rule.tag} count={count} />
        <ContextMenuSeparator />
        <SwatchMenuRow
          colors={colors}
          label={m.highlight_label()}
          value={rule.color}
          onSelect={(c) => setHighlight(rule.tag, c)}
        />
        {group.length > 1 && (
          <>
            <ContextMenuSeparator />
            <ContextMenuCheckboxItem
              checked={allOn}
              onCheckedChange={() => setGroupEnabled(rule.color, !allOn)}
            >
              {m.highlight_group_show({ count: group.length })}
            </ContextMenuCheckboxItem>
            <SwatchMenuRow
              colors={colors}
              label={m.highlight_group_color({ count: group.length })}
              value={rule.color}
              onSelect={(c) => recolorGroup(rule.color, c)}
            />
          </>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onSelect={() => removeHighlight(rule.id)}
        >
          <IconTrash />
          {m.highlight_remove()}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function AbsentRules({ rules }: { rules: Array<Highlight> }) {
  return (
    <section className="space-y-1 border-t pt-2">
      <h3 className="text-xs font-medium">
        {m.highlights_absent({ count: rules.length })}
      </h3>
      <p className="text-xs text-muted-foreground">
        {m.highlights_absent_description()}
      </p>
      <ul className="-mx-1 max-h-32 overflow-y-auto">
        {rules.map((rule) => (
          <li
            key={rule.id}
            style={hlStyle(highlightCss(rule.color))}
            className="flex items-center gap-2 rounded-sm py-0.5 pr-0.5 pl-2 hover:bg-muted"
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full bg-(--hl)"
            />
            <span
              className={cn(
                'min-w-0 flex-1 truncate font-mono text-xs',
                rule.enabled ? 'hl-ink' : 'text-muted-foreground line-through',
              )}
            >
              {rule.tag}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              className="max-md:size-11"
              aria-label={`${m.highlight_remove()}: ${rule.tag}`}
              onClick={() => removeHighlight(rule.id)}
            >
              <IconTrash />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function AddRuleForm({
  tagNames,
  existing,
}: {
  tagNames: Array<string>
  existing: Array<string>
}) {
  const [color, setColor] = useState<string | null>(null)
  const colors = useHighlightSwatches()
  const form = useForm({
    defaultValues: { tag: '' },
    onSubmit: ({ value }) => {
      const tag = value.tag.trim()
      if (!tag) return
      setHighlight(tag, color ?? nextPreset())
      form.reset()
    },
  })
  const taken = new Set(existing)
  const suggestions = tagNames.filter((t) => !taken.has(t))

  return (
    <form
      className="space-y-2 border-t pt-2"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <div className="flex items-center gap-1">
        <form.Field name="tag">
          {(field) => (
            <Input
              list="highlight-tag-suggestions"
              aria-label={m.highlight_tag_name()}
              placeholder={m.highlight_tag_name()}
              className="h-7 flex-1 font-mono"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          )}
        </form.Field>
        <datalist id="highlight-tag-suggestions">
          {suggestions.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <form.Subscribe selector={(s) => s.values.tag.trim() !== ''}>
          {(canSubmit) => (
            <Button type="submit" size="sm" disabled={!canSubmit}>
              {m.highlight_add()}
            </Button>
          )}
        </form.Subscribe>
      </div>
      <ColorSwatches
        colors={colors}
        value={color ?? undefined}
        onSelect={setColor}
      />
    </form>
  )
}
