import { TEMPLATE_TYPES } from './files'
import { errorDetail, notify } from './notice-store'
import { pickFile } from '#/lib/file-io'
import { templateOrder } from '#/lib/sort-order'
import { setCustomOrder } from '#/lib/store/profiles'
import { m } from '#/paraglide/messages'

/** Asks for a file, then sets the custom order to the names in it. */
export function pickTemplate() {
  pickFile(TEMPLATE_TYPES, (file) => void applyTemplate(file))
}

export async function applyTemplate(file: File) {
  const { name } = file
  let text: string
  try {
    text = await file.text()
  } catch (error) {
    notify.error(m.file_import_failed({ name }), {
      detail: errorDetail(error),
    })
    return
  }
  const result = templateOrder(name, text)
  if (!result.ok) {
    notify.error(m.sort_order_template_invalid({ name }), {
      detail: result.errors[0]?.message,
    })
    return
  }
  if (result.order.length === 0) {
    notify.error(m.sort_order_template_empty({ name }))
    return
  }
  setCustomOrder(result.order)
  notify.success(m.sort_order_template_set({ name }), {
    detail: m.sort_order_template_set_detail({ count: result.order.length }),
  })
}
