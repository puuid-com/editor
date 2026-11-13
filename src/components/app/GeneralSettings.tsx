import { useSyncExternalStore } from 'react'
import { useSelector } from '@tanstack/react-store'

import { SettingSwitch } from './FormatControls'
import { ShortcutKeys } from './ShortcutKeys'
import { setCodeFont, setCodeSize } from '#/components/editor/code-font'
import {
  editorPrefs,
  setSidebarRight,
  setWordWrapPref,
} from '#/components/editor/word-wrap'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Separator } from '#/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { codeFonts, codeSizes, fontFace } from '#/lib/code-font'
import type { CodeFontId, CodeSize } from '#/lib/code-font'
import { shortcuts } from '#/lib/shortcuts'
import { isDark, subscribeTheme, toggleTheme } from '#/lib/theme'
import { m } from '#/paraglide/messages'

/** Settings for every file and profile: theme, font, text size, wrap, sidebar side. */
export function GeneralSettings() {
  const dark = useSyncExternalStore(subscribeTheme, isDark, () => false)
  const prefs = useSelector(editorPrefs, (s) => s)

  return (
    <>
      <div className="flex flex-col py-1">
        <SettingSwitch
          id="settings-dark-theme"
          checked={dark}
          onCheckedChange={(on) => {
            if (on !== isDark()) toggleTheme()
          }}
        >
          {m.settings_dark_theme()}
        </SettingSwitch>
        <SettingSwitch
          id="settings-word-wrap"
          checked={prefs.wordWrap}
          onCheckedChange={setWordWrapPref}
        >
          {m.settings_word_wrap()}
          <ShortcutKeys shortcut={shortcuts.wordWrap} />
        </SettingSwitch>
        <SettingSwitch
          id="settings-sidebar-right"
          checked={prefs.sidebarRight}
          onCheckedChange={setSidebarRight}
        >
          {m.settings_sidebar_right()}
        </SettingSwitch>
      </div>
      <Separator />
      <div className="flex items-center justify-between gap-4 px-3 py-2.5">
        <span className="text-muted-foreground">{m.code_font()}</span>
        <Select
          value={prefs.codeFont}
          onValueChange={(id) => void setCodeFont(id as CodeFontId)}
        >
          <SelectTrigger size="sm" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {codeFonts.map((font) => (
              <SelectItem
                key={font.id}
                value={font.id}
                style={{ fontFamily: fontFace(font) }}
              >
                {font.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2 px-3 pt-0.5 pb-2.5">
        <span className="text-muted-foreground">{m.code_size()}</span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          className="w-full"
          value={String(prefs.codeSize)}
          onValueChange={(value) => {
            if (value) setCodeSize(Number(value) as CodeSize)
          }}
        >
          {codeSizes.map((size) => (
            <ToggleGroupItem
              key={size}
              value={String(size)}
              className="flex-1 tabular-nums"
            >
              {size}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </>
  )
}
