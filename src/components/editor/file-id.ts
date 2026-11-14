import { StateField } from '@codemirror/state'

/** The cached file this editor state belongs to. */
export const fileIdField = StateField.define<string>({
  create: () => '',
  update: (value) => value,
})
