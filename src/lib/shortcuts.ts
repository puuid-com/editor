import { formatForDisplay } from '@tanstack/react-hotkeys'

import { isMac } from './platform'
import type { HotkeyChord } from '@tanstack/react-hotkeys'

// Keyboard shortcuts, written once as TanStack Hotkeys bindings. The page binds
// the `hotkey`; editor shortcuts are bound in the CodeMirror keymap with `key`
// instead. How they look comes from the same binding, so the labels follow the
// platform: ⌥⇧⌘N on macOS, Ctrl+Alt+Shift+N elsewhere.
// Browsers keep ⌘N and ⌘W for themselves, so file shortcuts that VS Code puts
// there use the same keys as VS Code for the Web instead.

export interface Shortcut {
  hotkey: HotkeyChord
  /** CodeMirror key name, for shortcuts bound in the editor keymap. */
  key?: string
}

/** A shortcut the editor keymap binds, with its CodeMirror key name. */
function inEditor(hotkey: HotkeyChord) {
  const parts = hotkey.split('+')
  const key = parts
    .map((part, i) =>
      i === parts.length - 1
        ? part.toLowerCase()
        : part === 'Control'
          ? 'Ctrl'
          : part,
    )
    .join('-')
  return { hotkey, key }
}

export const shortcuts = {
  format: inEditor('Alt+Shift+F'),
  save: inEditor('Mod+S'),
  saveAs: inEditor('Mod+Shift+S'),
  highlight: inEditor('Alt+H'),
  applyDefaults: inEditor('Alt+Shift+D'),
  resolveVars: inEditor('Alt+Shift+V'),
  palette: { hotkey: 'Mod+K' },
  findInFiles: { hotkey: 'Mod+Shift+F' },
  quickOpen: { hotkey: 'Mod+P' },
  openFile: { hotkey: 'Mod+O' },
  newFile: { hotkey: 'Mod+Alt+N' },
  newJsonFile: { hotkey: 'Mod+Alt+Shift+N' },
  rename: { hotkey: 'F2' },
  // The editor binds these itself; the page ones act elsewhere, as on a tree row.
  undo: { hotkey: 'Mod+Z' },
  redo: { hotkey: 'Mod+Shift+Z' },
  // Windows and Linux only: Chrome on macOS keeps ⌘Y for its history.
  redoAlt: { hotkey: 'Mod+Y' },
  wordWrap: { hotkey: 'Alt+Z' },
  togglePanel: { hotkey: 'Mod+B' },
  nextProfile: { hotkey: 'Mod+Alt+P' },
  previousTab: { hotkey: 'Control+ArrowLeft' },
  nextTab: { hotkey: 'Control+ArrowRight' },
  tabList: { hotkey: 'Mod+Shift+A' },
  // As in VS Code's diff editor.
  nextChange: { hotkey: 'F7' },
  previousChange: { hotkey: 'Shift+F7' },
} satisfies Record<string, Shortcut>

/** ⌥⌘1 to ⌥⌘9 switch the current file to the profile in that position. */
export const profileShortcuts = (
  [
    'Mod+Alt+1',
    'Mod+Alt+2',
    'Mod+Alt+3',
    'Mod+Alt+4',
    'Mod+Alt+5',
    'Mod+Alt+6',
    'Mod+Alt+7',
    'Mod+Alt+8',
    'Mod+Alt+9',
  ] satisfies Array<HotkeyChord>
).map((hotkey): Shortcut => ({ hotkey }))

const platform = isMac ? 'mac' : 'windows'

/** One label per key, in the platform's order: `['⌥', '⇧', 'F']`. */
export function shortcutKeys(shortcut: Shortcut) {
  return formatForDisplay(shortcut.hotkey, { platform, parts: true })
}

/** The keys as one piece of text, as in `⌥⇧F` or `Alt+Shift+F`. */
export function shortcutLabel(shortcut: Shortcut) {
  return shortcutKeys(shortcut).join(isMac ? '' : '+')
}
