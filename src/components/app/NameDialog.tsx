import { useForm } from '@tanstack/react-form'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { validEntryName } from '#/lib/store/folders'
import { m } from '#/paraglide/messages'

/** Asks for a name, such as for a new file or a rename. */
export interface NameRequest {
  /** Tells requests apart, so each starts from its own name. */
  key: string
  title: string
  name: string
  /** Resolves false to keep the dialog open, marked invalid. */
  submit: (name: string) => Promise<boolean>
}

export function NameDialog({
  request,
  onClose,
}: {
  request: NameRequest | null
  onClose: () => void
}) {
  return (
    <Dialog
      open={!!request}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-sm">
        {request && (
          <NameForm key={request.key} request={request} done={onClose} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function NameForm({
  request,
  done,
}: {
  request: NameRequest
  done: () => void
}) {
  const [error, setError] = useState(false)
  const form = useForm({
    defaultValues: { name: request.name },
    onSubmit: async ({ value }) => {
      setError(false)
      try {
        if (await request.submit(value.name)) done()
        else setError(true)
      } catch {
        setError(true)
      }
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
        <DialogTitle>{request.title}</DialogTitle>
        <DialogDescription>{m.explorer_name_hint()}</DialogDescription>
      </DialogHeader>
      <form.Field
        name="name"
        validators={{
          onChange: ({ value }) =>
            validEntryName(value) ? undefined : m.explorer_invalid(),
        }}
      >
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor="entry-name">{m.rename_label()}</Label>
            <Input
              id="entry-name"
              autoFocus
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={!!field.state.meta.errors.length}
            />
            {field.state.meta.errors.map((message) => (
              <p key={message} className="text-xs text-destructive">
                {message}
              </p>
            ))}
          </div>
        )}
      </form.Field>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {m.explorer_invalid()}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" type="button" onClick={done}>
          {m.cancel()}
        </Button>
        <form.Subscribe selector={(s) => s.canSubmit && !s.isSubmitting}>
          {(enabled) => (
            <Button type="submit" disabled={!enabled}>
              {m.explorer_save()}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  )
}
