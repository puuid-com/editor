import { useForm } from '@tanstack/react-form'
import { useSelector } from '@tanstack/react-store'

import { notify } from './notice-store'
import { askVariableValue, uiStore } from './ui-store'
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
import { findVariable, setVariable } from '#/lib/store/variables'
import { m } from '#/paraglide/messages'

/** Sets the active profile's value for a variable picked in the editor. */
export function VariableValueDialog() {
  const name = useSelector(uiStore, (s) => s.variableName)

  return (
    <Dialog
      open={!!name}
      onOpenChange={(open) => {
        if (!open) askVariableValue(null)
      }}
    >
      <DialogContent className="sm:max-w-sm">
        {name && (
          <VariableValueForm
            key={name}
            name={name}
            value={findVariable(name)?.value ?? ''}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function VariableValueForm({ name, value }: { name: string; value: string }) {
  const form = useForm({
    defaultValues: { value },
    onSubmit: ({ value: submitted }) => {
      return setVariable(name, submitted.value)?.isPersisted.promise.then(
        () => {
          askVariableValue(null)
          notify.success(m.variables_saved({ name }))
        },
        () => {
          // The workspace reports the failed write; keep the draft open.
        },
      )
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
        <DialogTitle>{m.variables_dialog_title({ name })}</DialogTitle>
        <DialogDescription>
          {m.variables_dialog_description()}
        </DialogDescription>
      </DialogHeader>
      <form.Field name="value">
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor="variable-value">{m.variables_value()}</Label>
            <Input
              id="variable-value"
              autoFocus
              className="font-mono"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      </form.Field>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => askVariableValue(null)}
        >
          {m.cancel()}
        </Button>
        <form.Subscribe selector={(s) => s.canSubmit && !s.isSubmitting}>
          {(canSubmit) => (
            <Button type="submit" disabled={!canSubmit}>
              {m.variables_save()}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  )
}
