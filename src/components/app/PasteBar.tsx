import { useSelector } from '@tanstack/react-store'
import { useEffect, useRef, useState } from 'react'

import { FILE_TYPES, canReadAs } from './file-type'
import { applyPasteChoice } from './paste'
import { setPasteChoice, uiStore, updatePasteChoice } from './ui-store'
import { getView } from '#/components/editor/editor-store'
import { ProfileTag } from '#/components/profiles/ProfileTag'
import { Button } from '#/components/ui/button'
import { Kbd } from '#/components/ui/kbd'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { useProfiles } from '#/hooks/use-profiles'
import { isPlain } from '#/lib/document'
import { filesCollection } from '#/lib/store/files'
import { m } from '#/paraglide/messages'
import type { DocLanguage } from '#/lib/document'

const typeLabel = (language: DocLanguage) =>
  FILE_TYPES.find((t) => t.value === language)?.label() ?? language

/**
 * Sits under the tabs of a file whose content was pasted over, offering the
 * type the content reads as. Turning it down keeps the file as it is.
 */
export function PasteBar({ fileId }: { fileId: string }) {
  const choice = useSelector(uiStore, (s) =>
    s.pasteChoice?.fileId === fileId ? s.pasteChoice : null,
  )
  const profiles = useProfiles()
  const [saving, setSaving] = useState(false)
  const submitRef = useRef<HTMLButtonElement>(null)

  // Right after the paste, Enter takes the offer and Escape turns it down.
  useEffect(() => {
    if (choice) submitRef.current?.focus()
  }, [choice?.detected, choice?.current, !!choice])

  if (!choice) return null
  const content = filesCollection.get(fileId)?.content ?? ''

  const dismiss = () => {
    setPasteChoice(null)
    getView()?.focus()
  }

  const confirm = async () => {
    if (saving) return
    setSaving(true)
    await applyPasteChoice(choice).then(dismiss, () => {
      // The workspace reports the failed write; keep the offer up.
    })
    setSaving(false)
  }

  return (
    <div
      role="group"
      aria-label={
        choice.detected
          ? m.paste_mismatch({
              detected: typeLabel(choice.detected),
              current: typeLabel(choice.current),
            })
          : m.paste_unknown()
      }
      className="flex flex-wrap items-center gap-2 border-b bg-muted px-3 py-1.5 text-xs"
      onKeyDown={(e) => {
        // Escape inside an open select belongs to the select.
        if (e.key !== 'Escape' || !e.currentTarget.contains(e.target as Node))
          return
        e.preventDefault()
        dismiss()
      }}
    >
      {choice.detected ? (
        <span className="min-w-0 flex-1">
          {m.paste_mismatch({
            detected: typeLabel(choice.detected),
            current: typeLabel(choice.current),
          })}
        </span>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span id={`paste-type-${fileId}`}>{m.paste_unknown()}</span>
          <Select
            value={choice.language}
            onValueChange={(language) =>
              updatePasteChoice({ language: language as DocLanguage })
            }
          >
            <SelectTrigger
              size="sm"
              aria-labelledby={`paste-type-${fileId}`}
              className="bg-background"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILE_TYPES.map((type) => (
                <SelectItem
                  key={type.value}
                  value={type.value}
                  disabled={!canReadAs(content, type.value)}
                >
                  {type.label()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </span>
      )}

      {!isPlain(choice.language) && (
        <Select
          value={choice.profileId}
          onValueChange={(profileId) => updatePasteChoice({ profileId })}
        >
          <SelectTrigger
            size="sm"
            aria-label={m.paste_profile()}
            className="bg-background"
          >
            <span className="text-muted-foreground">{m.paste_profile()}</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {profiles.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                <ProfileTag profile={profile} className="max-w-48" />
                {profile.id === choice.bestMatch && (
                  <span className="text-muted-foreground">
                    {m.paste_best_match()}
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={saving}
          className="text-muted-foreground"
          onClick={dismiss}
        >
          {m.paste_keep({ type: typeLabel(choice.current) })}
        </Button>
        <Button
          ref={submitRef}
          size="sm"
          disabled={saving}
          onClick={() => void confirm()}
        >
          {choice.detected
            ? m.paste_switch({ type: typeLabel(choice.language) })
            : m.paste_apply()}
          <Kbd className="bg-primary-foreground/15 text-primary-foreground">
            ↵
          </Kbd>
        </Button>
      </div>
    </div>
  )
}
