import handler from '@tanstack/react-start/server-entry'
import { paraglideMiddleware } from './paraglide/server'
import { site } from './site'

// The site used to live here. Browsers keep the #fragment across the
// redirect, so old share links still open.
const LEGACY_HOST = 'xml.puuid.com'

// Resolves the locale for every request (URL prefix, then base locale) so
// server-rendered messages match the URL. See
// https://github.com/TanStack/router/tree/main/examples/react/start-i18n-paraglide
export default {
  fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    if (url.hostname === LEGACY_HOST) {
      return Promise.resolve(
        Response.redirect(`${site.url}${url.pathname}${url.search}`, 301),
      )
    }
    return paraglideMiddleware(req, () => handler.fetch(req))
  },
}
