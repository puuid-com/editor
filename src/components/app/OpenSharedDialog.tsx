import { useEffect, useState } from 'react'

import { notify } from './notice-store'
import { ProfileTag } from '#/components/profiles/ProfileTag'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import { Label } from '#/components/ui/label'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'
import { useActiveProfile } from '#/hooks/use-profiles'
import { decodeShare, isShareHash, ShareError } from '#/lib/share'
import type { SharedFile, SharedProfile } from '#/lib/share'
import { createFile, saveZplSettings } from '#/lib/store/files'
import { setActive } from '#/lib/store/session'
import {
  importSharedProfile,
  matchSharedProfile,
  sharedCounts,
  updateFromShared,
} from '#/lib/store/shared-profile'
import type { Profile } from '#/lib/store/profiles'
import type { SharedProfileMatch } from '#/lib/store/shared-profile'
import { m } from '#/paraglide/messages'

/** Drops the fragment so a reload doesn't ask again. */
function clearHash() {
  const { pathname, search } = window.location
  history.replaceState(history.state, '', pathname + search)
}

/** What opening a link does with the profile it carries. */
type ProfileChoice = 'import' | 'keep' | 'update' | 'ignore'

const loadZplLocation = () => import('#/components/zpl/open-label')

/** Asks before opening a file carried in a `#share=` link. */
export function OpenSharedDialog() {
  const [request, setRequest] = useState<{
    hash: string
    file: SharedFile
  } | null>(null)

  useEffect(() => {
    let revision = 0
    const read = () => {
      revision += 1
      const current = revision
      const { hash } = window.location
      const isCurrent = () =>
        current === revision && window.location.hash === hash
      if (!isShareHash(hash)) {
        void loadZplLocation()
          .then(({ openZplLocation }) => {
            if (isCurrent()) openZplLocation()
          })
          .catch(() => {
            if (isCurrent()) notify.error(m.share_open_invalid())
          })
        return
      }
      decodeShare(hash)
        .then((file) => {
          if (isCurrent()) setRequest({ hash, file })
        })
        .catch((error: unknown) => {
          if (!isCurrent()) return
          setRequest(null)
          clearHash()
          notify.error(
            error instanceof ShareError && error.reason === 'too-long'
              ? m.share_open_too_large()
              : m.share_open_invalid(),
          )
        })
    }
    const onHashChange = () => {
      setRequest(null)
      read()
    }
    read()
    window.addEventListener('hashchange', onHashChange)
    return () => {
      revision += 1
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [])

  const close = () => {
    clearHash()
    setRequest(null)
  }

  return (
    <AlertDialog
      open={!!request}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <AlertDialogContent>
        {request && (
          <OpenSharedForm
            key={request.hash}
            shared={request.file}
            onDone={close}
          />
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}

function OpenSharedForm({
  shared,
  onDone,
}: {
  shared: SharedFile
  onDone: () => void
}) {
  // Read once: opening the file shouldn't reshuffle the choices under it.
  const [match] = useState(() =>
    shared.profile ? matchSharedProfile(shared.profile) : null,
  )
  const [choice, setChoice] = useState<ProfileChoice>(
    match?.kind === 'none' ? 'import' : 'keep',
  )
  const current = useActiveProfile()

  const open = () => {
    const profile =
      shared.profile && match && pickProfile(shared.profile, match, choice)
    const file = createFile(
      shared.name,
      shared.content,
      (profile ?? current)?.id,
    )
    if (shared.zplSettings) saveZplSettings(file.id, shared.zplSettings)
    setActive(file.id)
    notify.success(
      profile
        ? m.share_opened_profile({ name: file.name, profile: profile.name })
        : m.share_opened({ name: file.name }),
    )
    onDone()
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {m.share_open_title({ name: shared.name })}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {m.share_open_description()}
        </AlertDialogDescription>
      </AlertDialogHeader>
      {shared.profile && match && (
        <ProfileChoices
          shared={shared.profile}
          match={match}
          current={current}
          value={choice}
          onChange={setChoice}
        />
      )}
      <AlertDialogFooter>
        <AlertDialogCancel>{m.share_open_cancel()}</AlertDialogCancel>
        <AlertDialogAction onClick={open}>
          {m.share_open_confirm()}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  )
}

/** Applies `choice`; the profile the file opens in, or none for the current one. */
function pickProfile(
  shared: SharedProfile,
  match: SharedProfileMatch,
  choice: ProfileChoice,
) {
  if (choice === 'import') return importSharedProfile(shared)
  if (match.kind === 'none' || choice === 'ignore') return undefined
  if (choice === 'update') updateFromShared(match.profile.id, shared)
  return match.profile
}

function ProfileChoices({
  shared,
  match,
  current,
  value,
  onChange,
}: {
  shared: SharedProfile
  match: SharedProfileMatch
  current: Profile | undefined
  value: ProfileChoice
  onChange: (choice: ProfileChoice) => void
}) {
  const counts = sharedCounts(shared)
  const local = match.kind === 'none' ? null : match.profile
  const options: Array<{
    value: ProfileChoice
    label: string
    detail: string
  }> = [
    ...(local
      ? [
          {
            value: 'keep' as const,
            label: m.share_profile_keep({ name: local.name }),
            detail:
              match.kind === 'same'
                ? m.share_profile_keep_same()
                : m.share_profile_keep_changed(),
          },
        ]
      : []),
    ...(local && match.kind === 'changed'
      ? [
          {
            value: 'update' as const,
            label: m.share_profile_update({ name: local.name }),
            detail: shared.variables
              ? m.share_profile_update_variables()
              : m.share_profile_update_detail(),
          },
        ]
      : []),
    ...(match.kind === 'same'
      ? []
      : [
          {
            value: 'import' as const,
            label: m.share_profile_import(),
            detail: m.share_profile_import_detail(),
          },
        ]),
    // Keeping the matched profile already means the current one.
    ...(!current || local?.id === current.id
      ? []
      : [
          {
            value: 'ignore' as const,
            label: m.share_profile_ignore({ name: current.name }),
            detail: m.share_profile_ignore_detail(),
          },
        ]),
  ]

  return (
    <div className="-mx-1 flex flex-col gap-3 border-y px-1 py-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {m.share_open_profile()}
          <ProfileTag profile={shared} />
        </div>
        <p className="text-muted-foreground">
          {shared.variables
            ? m.share_open_profile_detail({ ...counts })
            : m.share_open_no_variables({ ...counts })}
        </p>
      </div>
      <RadioGroup
        aria-label={m.share_profile_choice()}
        value={value}
        onValueChange={(v) => onChange(v as ProfileChoice)}
        className="gap-0"
      >
        {options.map((option) => (
          <Label
            key={option.value}
            htmlFor={`share-choice-${option.value}`}
            className="items-start gap-3 px-1 py-1.5 leading-normal font-normal hover:bg-muted"
          >
            <RadioGroupItem
              id={`share-choice-${option.value}`}
              value={option.value}
              className="mt-0.5"
            />
            <span className="flex min-w-0 flex-col">
              <span className="text-foreground">{option.label}</span>
              <span className="text-muted-foreground">{option.detail}</span>
            </span>
          </Label>
        ))}
      </RadioGroup>
    </div>
  )
}
