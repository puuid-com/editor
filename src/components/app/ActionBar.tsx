import {
  IconChevronUp,
  IconPlus,
  IconReplace,
  IconVariable,
  IconWand,
} from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'
import { useMemo } from 'react'

import { ShortcutKeys } from './ShortcutKeys'
import { setProfileDialog } from './ui-store'
import {
  applyDefaultsActive,
  convertVarsActive,
  formatActive,
  resolveVarsActive,
} from '#/components/editor/actions'
import { editorStore, getText } from '#/components/editor/editor-store'
import { hlStyle } from '#/components/highlights/hl-style'
import { switchProfile } from '#/components/profiles/actions'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { useEnabledDefaults } from '#/hooks/use-defaults'
import {
  useActiveProfile,
  useProfileFileCounts,
  useProfiles,
} from '#/hooks/use-profiles'
import { profileShortcuts, shortcuts } from '#/lib/shortcuts'
import { profileCss } from '#/lib/store/profiles'
import { splitOverflow } from '#/lib/overflow'
import { cn } from '#/lib/utils'
import { defaultSummary } from '#/lib/xml/defaults'
import { varStyles, writeVar } from '#/lib/xml/vars'
import { m } from '#/paraglide/messages'
import type { Shortcut } from '#/lib/shortcuts'
import type { Profile } from '#/lib/store/profiles'
import type { VarStyle } from '#/lib/xml/vars'

const VAR_STYLES: Array<VarStyle> = ['curly', 'angle', 'dollar']

let lastVars = { revision: -1, value: varStyles('') }

/** Variables of the active text, read again only after a new parse. */
function varsAt(revision: number) {
  if (lastVars.revision !== revision)
    lastVars = { revision, value: varStyles(getText()) }
  return lastVars.value
}

/**
 * Bottom bar controls for the active file: a labelled switch for its profile
 * and one for its variable style, then the actions that use them.
 */
export function ActionBar() {
  const doc = useSelector(editorStore, (s) => s.doc)
  const vars = useSelector(editorStore, (s) => varsAt(s.revision))
  const rules = useEnabledDefaults()
  const defaults = useMemo(
    () =>
      defaultSummary(doc.nodes, rules).reduce((n, rule) => n + rule.count, 0),
    [doc, rules],
  )

  return (
    <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
      <ProfileSwitch />
      {vars.count > 0 && (
        <>
          <Divider />
          <span className="max-lg:hidden">{m.variables_tab()}</span>
          <VarStyleSwitch style={vars.style} />
        </>
      )}
      <Divider />
      <div className="flex items-center text-foreground">
        <FormatButton />
        <ActionButton
          label={m.defaults_apply()}
          detail={
            defaults > 0
              ? m.status_defaults_count({ count: defaults })
              : rules.length === 0
                ? m.defaults_none()
                : m.defaults_unchanged()
          }
          shortcut={shortcuts.applyDefaults}
          disabled={defaults === 0}
          onClick={applyDefaultsActive}
        >
          <IconReplace />
          {m.defaults_apply()}
          <Count value={defaults} />
        </ActionButton>
        <ActionButton
          label={m.vars_resolve()}
          detail={
            vars.count > 0
              ? m.status_vars_count({ count: vars.count })
              : m.vars_resolve_none()
          }
          shortcut={shortcuts.resolveVars}
          disabled={vars.count === 0}
          onClick={resolveVarsActive}
        >
          <IconVariable />
          {m.vars_resolve_short()}
          <Count value={vars.count} />
        </ActionButton>
      </div>
    </div>
  )
}

/** Formats the active file; disabled while it has errors. */
export function FormatButton() {
  const formatError = useSelector(editorStore, (s) => s.doc.errors.at(0))
  return (
    <ActionButton
      label={m.action_format()}
      detail={formatError ? formatError.message : null}
      shortcut={shortcuts.format}
      disabled={formatError !== undefined}
      onClick={formatActive}
    >
      <IconWand />
      {m.action_format()}
    </ActionButton>
  )
}

function Divider() {
  return (
    <span
      aria-hidden
      className="mx-1 h-4 w-px shrink-0 self-center bg-border"
    />
  )
}

/** Profiles beyond this many go in a menu, so the bar keeps its width. */
const MAX_PROFILES = 4

/**
 * The most used profiles side by side, the active one always among them, and
 * the rest in a menu. One click moves the file to a profile, two edit it.
 */
function ProfileSwitch() {
  const profiles = useProfiles()
  const active = useActiveProfile()
  const counts = useProfileFileCounts()
  if (!active) return null

  const { shown, hidden } = splitOverflow(
    profiles,
    MAX_PROFILES,
    (p) => counts.get(p.id) ?? 0,
    (p) => p.id === active.id,
  )

  return (
    <>
      <span className="max-lg:hidden">{m.status_profile()}</span>
      <div className="flex shrink-0 items-center">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          aria-label={m.profiles_title()}
          value={active.id}
          onValueChange={(id) => {
            if (id) void switchProfile(id)
          }}
        >
          {shown.map((profile) => {
            const shortcut = profileShortcuts.at(profiles.indexOf(profile))
            return (
              <Tooltip key={profile.id}>
                <TooltipTrigger asChild>
                  <ToggleGroupItem
                    value={profile.id}
                    aria-label={m.profile_label({ name: profile.name })}
                    style={hlStyle(profileCss(profile))}
                    onDoubleClick={() =>
                      setProfileDialog({ mode: 'edit', profileId: profile.id })
                    }
                    className={cn(
                      'h-5 max-w-28 min-w-0 gap-1.5 px-1.5 text-[11px] font-normal text-muted-foreground aria-checked:bg-(--hl)/15 aria-checked:font-medium max-md:h-8',
                      profile.id === active.id && 'hl-ink',
                    )}
                  >
                    <ProfileDot />
                    <span className="truncate">{profile.name}</span>
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent className="flex items-center gap-2">
                  <span className="flex flex-col">
                    {profile.name}
                    <span className="opacity-70">
                      {m.status_profile_edit_hint()}
                    </span>
                  </span>
                  {shortcut && <ShortcutKeys shortcut={shortcut} />}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </ToggleGroup>
        {hidden.length > 0 ? (
          <MoreProfilesMenu profiles={hidden} />
        ) : (
          <NewProfileButton />
        )}
      </div>
    </>
  )
}

function ProfileDot() {
  return (
    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-(--hl)" />
  )
}

function NewProfileButton() {
  return (
    <Button
      variant="outline"
      size="icon-xs"
      aria-label={m.profile_new()}
      onClick={() => setProfileDialog({ mode: 'create' })}
      className="size-5 border-l-0 text-muted-foreground max-md:size-8"
    >
      <IconPlus />
    </Button>
  )
}

/** The less used profiles, plus the way to make a new one. */
function MoreProfilesMenu({ profiles }: { profiles: Array<Profile> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="xs"
          aria-label={m.profiles_more({ count: profiles.length })}
          className="h-5 gap-0.5 border-l-0 px-1 font-mono text-[11px] font-normal text-muted-foreground tabular-nums max-md:h-8"
        >
          +{profiles.length}
          <IconChevronUp />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-56">
        <DropdownMenuLabel>
          {m.profiles_more({ count: profiles.length })}
        </DropdownMenuLabel>
        {profiles.map((profile) => (
          <DropdownMenuItem
            key={profile.id}
            style={hlStyle(profileCss(profile))}
            onSelect={() => void switchProfile(profile.id)}
          >
            <ProfileDot />
            <span className="truncate">{profile.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setProfileDialog({ mode: 'create' })}>
          <IconPlus />
          {m.profile_new()}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The bracket style the file's variables share; picking one rewrites them all. */
function VarStyleSwitch({ style }: { style: VarStyle | null }) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={0}
      aria-label={m.vars_convert()}
      value={style ?? ''}
      onValueChange={(value) => {
        if (value) convertVarsActive(value as VarStyle)
      }}
      className="shrink-0"
    >
      {VAR_STYLES.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          aria-label={m.status_vars_switch({ style: writeVar('x', option) })}
          className="h-5 min-w-0 px-1.5 font-mono text-[10.5px] font-normal text-muted-foreground data-[state=on]:bg-foreground data-[state=on]:text-background max-md:h-8"
        >
          {writeVar('x', option)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/** Muted count after an action's label; nothing when zero. */
function Count({ value }: { value: number }) {
  if (value === 0) return null
  return (
    <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
      {value}
    </span>
  )
}

/**
 * Icon and text button whose tooltip spells out the action and its shortcut.
 * A disabled one still shows its tooltip, which says why it can't run.
 */
function ActionButton({
  label,
  detail,
  shortcut,
  disabled,
  ...props
}: React.ComponentProps<typeof Button> & {
  label: string
  detail?: string | null
  shortcut: Shortcut
}) {
  return (
    <Tooltip>
      {/* Disabled buttons get no pointer events, so the span holds the tooltip. */}
      <TooltipTrigger asChild>
        <span tabIndex={disabled ? 0 : undefined} className="inline-flex">
          <Button
            variant="ghost"
            size="xs"
            className="gap-1 px-1.5 text-[11px] font-normal max-md:h-11"
            disabled={disabled}
            {...props}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent className="flex items-center gap-2">
        <span className="flex flex-col">
          {label}
          {detail && <span className="opacity-70">{detail}</span>}
        </span>
        <ShortcutKeys shortcut={shortcut} />
      </TooltipContent>
    </Tooltip>
  )
}
