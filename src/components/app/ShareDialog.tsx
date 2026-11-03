import { IconLink } from '@tabler/icons-react'
import { useForm } from '@tanstack/react-form'
import { useSelector } from '@tanstack/react-store'

import { ToolbarButton } from './ToolbarButton'
import { setShareOpen, uiStore } from './ui-store'
import { copyShareLink } from '#/components/editor/actions'
import { ProfileTag } from '#/components/profiles/ProfileTag'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { useDefaults } from '#/hooks/use-defaults'
import { useOpenFiles } from '#/hooks/use-files'
import { useHighlights } from '#/hooks/use-highlights'
import { usePins } from '#/hooks/use-pins'
import { useActiveProfile } from '#/hooks/use-profiles'
import { useVariables } from '#/hooks/use-variables'
import { m } from '#/paraglide/messages'

/** Opens the share dialog for the active file. */
export function ShareButton() {
  return (
    <ToolbarButton
      label={m.share_button()}
      size="icon-sm"
      className="mx-1"
      onClick={() => setShareOpen(true)}
    >
      <IconLink />
    </ToolbarButton>
  )
}

/** Picks what a share link of the active file carries, then copies it. */
export function ShareLinkDialog({ activeId }: { activeId: string | null }) {
  const open = useSelector(uiStore, (s) => s.shareOpen)
  const file = useOpenFiles().find((f) => f.id === activeId)

  return (
    <Dialog open={open && !!file} onOpenChange={setShareOpen}>
      <DialogContent className="sm:max-w-md">
        {file && <ShareLinkForm name={file.name} />}
      </DialogContent>
    </Dialog>
  )
}

function ShareLinkForm({ name }: { name: string }) {
  const profile = useActiveProfile()
  const highlights = useHighlights().length
  const pins = usePins().length
  const defaults = useDefaults().length
  const variables = useVariables().length
  const form = useForm({
    defaultValues: { profile: true, variables: true },
    onSubmit: async ({ value }) => {
      if (await copyShareLink(value)) setShareOpen(false)
    },
  })

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <DialogHeader>
        <DialogTitle>{m.share_title({ name })}</DialogTitle>
        <DialogDescription>{m.share_description()}</DialogDescription>
      </DialogHeader>
      {profile && (
        <div className="-mx-1 flex flex-col border-y py-1">
          <form.Field name="profile">
            {(field) => (
              <OptionSwitch
                id="share-profile"
                checked={field.state.value}
                onCheckedChange={field.handleChange}
                label={
                  <>
                    {m.share_include_profile()}
                    <ProfileTag profile={profile} />
                  </>
                }
                detail={m.share_profile_detail({ highlights, pins, defaults })}
              />
            )}
          </form.Field>
          {variables > 0 && (
            <form.Subscribe selector={(s) => s.values.profile}>
              {(withProfile) => (
                <form.Field name="variables">
                  {(field) => (
                    <OptionSwitch
                      id="share-variables"
                      checked={withProfile && field.state.value}
                      disabled={!withProfile}
                      onCheckedChange={field.handleChange}
                      label={m.share_include_variables()}
                      detail={m.share_variables_detail({ count: variables })}
                    />
                  )}
                </form.Field>
              )}
            </form.Subscribe>
          )}
        </div>
      )}
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShareOpen(false)}
        >
          {m.cancel()}
        </Button>
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(submitting) => (
            <Button type="submit" disabled={submitting}>
              {m.share_copy_confirm()}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  )
}

function OptionSwitch({
  id,
  label,
  detail,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string
  label: React.ReactNode
  detail: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start gap-3 px-1 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Label htmlFor={id} className="gap-2">
          {label}
        </Label>
        <p className="text-muted-foreground">{detail}</p>
      </div>
      <Switch
        id={id}
        size="sm"
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  )
}
