import { errorDetail, notify } from './notice-store'
import { m } from '#/paraglide/messages'

/**
 * Copies `text`, then confirms it with `detail`, or says the browser refused,
 * such as when the page isn't focused or clipboard access is blocked.
 */
export async function copyText(text: string, detail?: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch (error) {
    notify.error(m.copy_failed(), {
      detail: errorDetail(error),
    })
    return false
  }
  notify.success(m.copied(), { detail })
  return true
}
