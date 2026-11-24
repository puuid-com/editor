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
    // Some embedded browsers deny the async clipboard API outright.
    if (!legacyCopy(text)) {
      notify.error(m.copy_failed(), {
        detail: errorDetail(error),
      })
      return false
    }
  }
  notify.success(m.copied(), { detail })
  return true
}

function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.readOnly = true
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}
