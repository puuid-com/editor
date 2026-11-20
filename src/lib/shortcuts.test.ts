import { describe, expect, it } from 'vitest'

import { profileShortcuts, shortcutKeys, shortcuts } from './shortcuts'

describe('shortcuts', () => {
  it('names editor shortcuts the way CodeMirror reads them', () => {
    expect(shortcuts.format.key).toBe('Alt-Shift-f')
    expect(shortcuts.save.key).toBe('Mod-s')
    expect(shortcuts.saveAs.key).toBe('Mod-Shift-s')
  })

  it('shows one label per key', () => {
    expect(shortcutKeys(shortcuts.rename)).toEqual(['F2'])
    expect(shortcutKeys(profileShortcuts[2]).at(-1)).toBe('3')
    expect(shortcutKeys(shortcuts.newJsonFile)).toHaveLength(4)
  })

  it('uses each binding once', () => {
    const all = [...Object.values(shortcuts), ...profileShortcuts]
    const hotkeys = all.map((shortcut) => shortcut.hotkey)
    expect(new Set(hotkeys).size).toBe(hotkeys.length)
  })
})
