import { notify } from './notice-store'
import { settleContentSave } from '#/lib/store/files'
import { logEvent } from '#/lib/rescue/client'
import { m } from '#/paraglide/messages'

/**
 * Says that a part of the editor fetched on demand, such as a dialog, did
 * not arrive, and offers to reload the page: the browser may not fetch it a
 * second time otherwise. What was just typed is saved first.
 */
export function reportLoadFailed() {
  logEvent('error', 'Part of the editor could not be downloaded')
  notify.error(m.part_load_failed(), {
    action: {
      label: m.reload_page(),
      run: () =>
        void settleContentSave().finally(() => window.location.reload()),
    },
  })
}
