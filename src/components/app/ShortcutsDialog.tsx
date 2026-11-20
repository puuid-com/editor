import { useSelector } from '@tanstack/react-store'

import { ShortcutKeys } from './ShortcutKeys'
import { setShortcutsOpen, uiStore } from './ui-store'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Kbd } from '#/components/ui/kbd'
import { isMac } from '#/lib/platform'
import { profileShortcuts, shortcuts } from '#/lib/shortcuts'
import type { Shortcut } from '#/lib/shortcuts'
import { m } from '#/paraglide/messages'

interface Row {
  label: string
  /** Each one does the same thing. */
  keys: Array<Shortcut>
  /** Drawn after the keys, as the end of a range. */
  through?: string
}

interface Group {
  title: string
  rows: Array<Row>
}

function groups(): Array<Group> {
  return [
    {
      title: m.shortcuts_general(),
      rows: [
        {
          label: m.palette_title(),
          keys: [shortcuts.palette, shortcuts.quickOpen],
        },
        { label: m.find_in_files(), keys: [shortcuts.findInFiles] },
        { label: m.shortcuts_panel_toggle(), keys: [shortcuts.togglePanel] },
        { label: m.word_wrap_toggle(), keys: [shortcuts.wordWrap] },
      ],
    },
    {
      title: m.palette_file(),
      rows: [
        { label: m.file_new(), keys: [shortcuts.newFile] },
        { label: m.file_new_json(), keys: [shortcuts.newJsonFile] },
        { label: m.file_open_disk(), keys: [shortcuts.openFile] },
        { label: m.shortcuts_save(), keys: [shortcuts.save] },
        { label: m.file_save_disk(), keys: [shortcuts.saveAs] },
        { label: m.file_rename(), keys: [shortcuts.rename] },
      ],
    },
    {
      title: m.palette_edit(),
      rows: [
        { label: m.edit_undo(), keys: [shortcuts.undo] },
        {
          label: m.edit_redo(),
          keys: isMac ? [shortcuts.redo] : [shortcuts.redo, shortcuts.redoAlt],
        },
        { label: m.action_format(), keys: [shortcuts.format] },
        { label: m.highlight_at_cursor(), keys: [shortcuts.highlight] },
        { label: m.defaults_apply(), keys: [shortcuts.applyDefaults] },
        { label: m.vars_resolve(), keys: [shortcuts.resolveVars] },
      ],
    },
    {
      title: m.shortcuts_tabs(),
      rows: [
        { label: m.shortcuts_tab_previous(), keys: [shortcuts.previousTab] },
        { label: m.shortcuts_tab_next(), keys: [shortcuts.nextTab] },
        { label: m.tabs_list(), keys: [shortcuts.tabList] },
      ],
    },
    {
      title: m.profiles_title(),
      rows: [
        { label: m.profile_next(), keys: [shortcuts.nextProfile] },
        {
          label: m.shortcuts_profile_at(),
          keys: [profileShortcuts[0]],
          through: '9',
        },
      ],
    },
    {
      title: m.shortcuts_compare(),
      rows: [
        { label: m.compare_next(), keys: [shortcuts.nextChange] },
        { label: m.compare_previous(), keys: [shortcuts.previousChange] },
      ],
    },
  ]
}

/** Every keyboard shortcut, grouped as in the command menu. */
export function ShortcutsDialog() {
  const open = useSelector(uiStore, (s) => s.shortcutsOpen)

  return (
    <Dialog open={open} onOpenChange={setShortcutsOpen}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{m.shortcuts_title()}</DialogTitle>
          <DialogDescription>{m.shortcuts_description()}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
          {groups().map((group) => (
            <section key={group.title} className="min-w-0">
              <h3 className="mb-1 text-xs font-medium text-muted-foreground">
                {group.title}
              </h3>
              <ul className="divide-y">
                {group.rows.map((row) => (
                  <li
                    key={row.label}
                    className="flex min-h-9 items-center justify-between gap-4 py-1.5 text-sm"
                  >
                    <span className="min-w-0">{row.label}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      {row.keys.map((shortcut, i) => (
                        <span
                          key={shortcut.hotkey}
                          className="flex items-center gap-1.5"
                        >
                          {i > 0 && <span aria-hidden>/</span>}
                          <ShortcutKeys shortcut={shortcut} />
                        </span>
                      ))}
                      {row.through && (
                        <>
                          <span aria-hidden>–</span>
                          <Kbd>{row.through}</Kbd>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
