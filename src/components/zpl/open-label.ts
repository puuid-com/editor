import { notify } from '#/components/app/notice-store'
import { openBeside, MAX_PANES } from '#/components/app/panes'
import { decodeBase64Zpl } from '#/lib/zpl/base64'
import { decodeShareHash } from '#/lib/zpl/share'
import { normalizeSettings } from '#/lib/zpl/schema'
import { createFile, saveZplSettings } from '#/lib/store/files'
import { activeProfileId } from '#/lib/store/profiles'
import { sessionStore, setActive } from '#/lib/store/session'
import { m } from '#/paraglide/messages'

export function openLabel(text: string, settings?: Record<string, unknown>) {
  const source = decodeBase64Zpl(text) ?? text
  const file = createFile(m.file_untitled_zpl(), source, activeProfileId())
  if (settings) saveZplSettings(file.id, normalizeSettings(settings))
  if ((sessionStore.state.panes?.length ?? 0) < MAX_PANES) openBeside(file.id)
  else setActive(file.id)
  return file.id
}

/** Consume only ZPL parameters, preserving unrelated URL state. */
export function openZplLocation() {
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.slice(1))
  const params = hash.has('zpl') || hash.has('base64') ? hash : url.searchParams
  if (!params.has('zpl') && !params.has('base64')) return
  try {
    const shared = decodeShareHash(params.toString())
    if (shared) openLabel(shared.source, shared.settings)
  } catch {
    notify.error(m.share_open_invalid())
  }
  for (const key of ['zpl', 'base64', 'dpmm', 'w', 'h']) params.delete(key)
  if (params === hash) url.hash = params.toString()
  history.replaceState(history.state, '', url.pathname + url.search + url.hash)
}
