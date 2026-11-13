import {
  IconAdjustmentsHorizontal,
  IconSettings,
  IconUserCircle,
  IconVariable,
  IconWand,
  IconWriting,
} from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'

import { CommandMenuButton } from './CommandMenu'
import { FormatOptions } from './FormatControls'
import { GeneralSettings } from './GeneralSettings'
import { openSettings, setSettingsSection, settingsTab } from './settings-tab'
import { TabStrip } from './TabStrip'
import { ToolbarButton } from './ToolbarButton'
import { DefaultsRules } from '#/components/defaults/DefaultsControls'
import { ProfilesPanel } from '#/components/profiles/ProfilesPanel'
import { ProfileTag } from '#/components/profiles/ProfileTag'
import { SidebarTrigger } from '#/components/ui/sidebar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { VariablesList } from '#/components/variables/VariablesControls'
import { useMediaQuery } from '#/hooks/use-media-query'
import { useActiveProfile } from '#/hooks/use-profiles'
import { m } from '#/paraglide/messages'
import type { SettingsSection } from './settings-tab'

const SECTIONS: Array<{
  id: SettingsSection
  label: () => string
  icon: typeof IconWand
  /** Saved to the active file's profile rather than for every file. */
  profiled?: boolean
  content: () => React.ReactNode
}> = [
  {
    id: 'general',
    label: m.settings_general,
    icon: IconAdjustmentsHorizontal,
    content: () => <GeneralSettings />,
  },
  {
    id: 'format',
    label: m.action_format,
    icon: IconWand,
    profiled: true,
    content: () => <FormatOptions structured />,
  },
  {
    id: 'defaults',
    label: m.defaults_tab,
    icon: IconWriting,
    profiled: true,
    content: () => <DefaultsRules />,
  },
  {
    id: 'variables',
    label: m.variables_tab,
    icon: IconVariable,
    profiled: true,
    content: () => <VariablesList />,
  },
  {
    id: 'profiles',
    label: m.profiles_title,
    icon: IconUserCircle,
    content: () => <ProfilesPanel />,
  },
]

/**
 * Every setting, as a page in the settings tab: sections down the side, the
 * picked one beside them. General applies to every file; Format, Defaults
 * and Variables to the active file's profile.
 */
export function SettingsPage() {
  const section = useSelector(settingsTab, (s) => s.section)
  const wide = useMediaQuery('(min-width: 768px)')
  const profile = useActiveProfile()

  return (
    <div className="h-full overflow-y-auto">
      <Tabs
        value={section}
        onValueChange={(value) => setSettingsSection(value as SettingsSection)}
        orientation={wide ? 'vertical' : 'horizontal'}
        className="mx-auto w-full max-w-3xl gap-6 px-4 py-6 md:flex-row md:gap-10 md:px-8 md:py-10"
      >
        <TabsList
          aria-label={m.editor_settings()}
          className="shrink-0 justify-start gap-0.5 rounded-none bg-transparent p-0 max-md:w-full max-md:overflow-x-auto max-md:[scrollbar-width:none] md:w-40 md:items-stretch"
        >
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="h-8 flex-none justify-start gap-2 px-2.5 font-normal data-active:bg-muted data-active:font-medium dark:data-active:border-transparent dark:data-active:bg-muted"
            >
              <Icon />
              {label()}
            </TabsTrigger>
          ))}
        </TabsList>
        {SECTIONS.map(({ id, label, profiled, content }) => (
          <TabsContent key={id} value={id} className="flex min-w-0 flex-col">
            <div className="mb-3 flex min-h-6 items-center justify-between gap-4">
              <h2 className="text-sm font-semibold">{label()}</h2>
              {profiled && profile && (
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  {m.profile_settings_scope()}
                  <ProfileTag profile={profile} />
                </span>
              )}
            </div>
            <div className="overflow-hidden rounded-lg border">{content()}</div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

/** The sheet when no file is open: the settings tab alone. */
export function SettingsSheet() {
  return (
    <section className="flex h-full min-w-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-0.5 border-b px-1.5 md:h-10">
        <SidebarTrigger className="shrink-0 text-muted-foreground max-md:size-11 md:hidden" />
        <TabStrip
          files={[]}
          activeId={null}
          paneId="settings"
          settings
          settingsActive
        />
        <CommandMenuButton />
      </header>
      <div className="min-h-0 flex-1">
        <SettingsPage />
      </div>
    </section>
  )
}

/** Opens the settings tab, from the sidebar's footer. */
export function SettingsButton() {
  return (
    <ToolbarButton
      label={m.editor_settings()}
      size="icon-sm"
      className="text-muted-foreground"
      onClick={() => openSettings()}
    >
      <IconSettings />
    </ToolbarButton>
  )
}
