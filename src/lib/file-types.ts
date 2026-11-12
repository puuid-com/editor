/**
 * A file's type as the explorer hides it: its last extension, lowercase and
 * without the dot. Names without one, or only a leading dot, have none.
 */
export function fileTypeOf(name: string): string | null {
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return null
  return name.slice(dot + 1).toLowerCase()
}

/** Whether the explorer leaves `name` out, given the hidden types. */
export function isHiddenType(hidden: ReadonlyArray<string>, name: string) {
  const type = fileTypeOf(name)
  return type !== null && hidden.includes(type)
}
