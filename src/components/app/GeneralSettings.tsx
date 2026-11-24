import { useSelector } from '@tanstack/react-store'

import { SettingSwitch } from './FormatControls'
import { ShortcutKeys } from './ShortcutKeys'
import { setCodeFont, setCodeSize } from '#/components/editor/code-font'
import { panelSideLabel } from './panel-side-label'
import {
  editorPrefs,
  setPanelSide,
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
import { useDarkMode } from '#/hooks/use-dark-mode'
import { codeFonts, codeSizes, fontFace } from '#/lib/code-font'
import type { CodeFontId, CodeSize } from '#/lib/code-font'
import { PANEL_SIDES } from '#/lib/panel-side'
import type { PanelSide } from '#/lib/panel-side'
import { shortcuts } from '#/lib/shortcuts'
import { isDark, toggleTheme } from '#/lib/theme'
import { m } from '#/paraglide/messages'

/** Settings for every file and profile: theme, wrap, sidebar side, side panel position, font, text size. */
export function GeneralSettings() {
  const dark = useDarkMode()
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
        <span>{m.panel_position()}</span>
        <Select
          value={prefs.panelSide}
          onValueChange={(side) => setPanelSide(side as PanelSide)}
        >
          <SelectTrigger size="sm" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PANEL_SIDES.map((side) => (
              <SelectItem key={side} value={side}>
                {panelSideLabel(side)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between gap-4 px-3 pt-0.5 pb-2.5">
        <span>{m.code_font()}</span>
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
        <span>{m.code_size()}</span>
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
