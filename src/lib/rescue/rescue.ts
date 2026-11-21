// The recovery screen: the editor's last line of defence when it breaks.
//
// It runs as an inline script at the top of every page, before any of the
// app's code, so it works when that code doesn't: a render error that wipes
// the page, a load that never finishes, a chunk that fails to download. It
// logs every error, shows a screen whenever the app isn't on screen, and
// reads IndexedDB itself to hand back the files and settings.
//
// `installRescue` is serialized with `toString()` (see `script.ts`), so it
// must stay self-contained: no imports and no references to anything
// outside its body but browser globals. Types are fine; they're erased.

/** Every string the screen shows, in the page's language. */
export interface RescueText {
  titleFatal: string
  bodyFatal: string
  titleStuck: string
  bodyStuck: string
  titleBlocked: string
  bodyBlocked: string
  titleManual: string
  bodyManual: string
  /** Has `{step}`. */
  lastStep: string
  keepData: string
  downloadBackup: string
  downloadFiles: string
  /** Has `{name}`. */
  backupDone: string
  /** Has `{name}`. */
  filesDone: string
  noFiles: string
  /** Has `{error}`. */
  readFailed: string
  /** Has `{date}`. */
  backupName: string
  /** Has `{date}`. */
  filesName: string
  deletedFolder: string
  getHelp: string
  askClaude: string
  askChatGpt: string
  copyDetails: string
  copied: string
  copyFailed: string
  helpNote: string
  tryAgain: string
  reload: string
  resetLayout: string
  resetNote: string
  erase: string
  eraseConfirm: string
  eraseNoBackup: string
  eraseBlocked: string
  close: string
  keepWaiting: string
  showLog: string
  logEmpty: string
  unexpected: string
  details: string
  /** Has `{url}`, `{problem}` and `{report}`. */
  aiPrompt: string
}

export interface RescueInfo {
  version: string
  dev: boolean
}

export type RescueLevel = 'info' | 'warn' | 'error'

export interface RescueEntry {
  time: number
  level: RescueLevel
  message: string
}

export type RescueKind = 'fatal' | 'stuck' | 'blocked' | 'manual'

export interface RescueOpenOptions {
  error?: unknown
  kind?: RescueKind
  /** Closes by itself once the app is on screen again. */
  auto?: boolean
}

/** What the app reaches through `window.__editorRescue`. */
export interface RescueApi {
  log: (level: RescueLevel, message: string, detail?: unknown) => void
  open: (options?: RescueOpenOptions) => void
  entries: () => Array<RescueEntry>
}

type Row = Record<string, unknown>
type Stores = Partial<Record<string, Array<Row>>>

export function installRescue(text: RescueText, info: RescueInfo) {
  const global = window as unknown as { __editorRescue?: RescueApi }
  if (global.__editorRescue) return

  const DB_NAME = 'xml-editor'
  const PREFIX = 'xml-editor:'
  const LOG_KEY = 'editor-log'
  const COLLECTIONS = [
    'files',
    'folders',
    'profiles',
    'highlights',
    'pins',
    'defaults',
    'variables',
  ]
  const READY = '[data-app-ready]'
  const STUCK_MS = info.dev ? 60_000 : 15_000
  // Before the app shows, an error gets this long to be harmless.
  const GRACE_MS = 3000
  const MAX_ENTRIES = 300
  const MAX_MESSAGE = 4000
  const MAX_AI_URL = 8000
  const AI = [
    ['askClaude', 'https://claude.ai/new?q='],
    ['askChatGpt', 'https://chatgpt.com/?q='],
  ] as const
  const started = Date.now()
  const undo: Array<() => void> = []
  const listen = <TType extends keyof WindowEventMap>(
    type: TType,
    handler: (event: WindowEventMap[TType]) => void,
    capture = false,
  ) => {
    window.addEventListener(type, handler, capture)
    undo.push(() => window.removeEventListener(type, handler, capture))
  }
  const ERROR_EVENT = 'editor:error'
  // The open screen, if any, and its log, which fills as entries come.
  let panel: HTMLElement | undefined
  let panelAuto = false
  let panelKind: RescueKind = 'manual'
  let logPre: HTMLElement | undefined
  let toastNode: HTMLElement | undefined
  let releaseFocus: (() => void) | undefined
  const original = {
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  }

  /* ---------------- Log ---------------- */

  const describe = (value: unknown): string => {
    if (value instanceof Error) {
      const head = `${value.name}: ${value.message}`
      const stack = value.stack ?? ''
      const body = stack.includes(value.message) ? stack : `${head}\n${stack}`
      const cause =
        value.cause === undefined ? '' : `\nCaused by: ${describe(value.cause)}`
      return (body || head) + cause
    }
    if (typeof value === 'string') return value
    if (value instanceof Event) {
      const target = value.target as { src?: string; href?: string } | null
      return `${value.type} event${target?.src || target?.href ? ` on ${target.src || target.href}` : ''}`
    }
    try {
      // Undefined for undefined and functions, whatever the types say.
      const json = JSON.stringify(value) as string | undefined
      return json ?? String(value)
    } catch {
      return String(value)
    }
  }

  let entries: Array<RescueEntry> = []
  try {
    const stored = JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]') as unknown
    if (Array.isArray(stored)) entries = stored.slice(-MAX_ENTRIES)
  } catch {
    // No storage: the log starts empty and lasts for this page.
  }

  let saveTimer: ReturnType<typeof setTimeout> | undefined
  const saveLog = () => {
    clearTimeout(saveTimer)
    saveTimer = undefined
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(entries))
    } catch {
      // Full or off; the log still holds this page's entries.
    }
  }

  const record = (level: RescueLevel, message: string) => {
    entries.push({
      time: Date.now(),
      level,
      message: message.slice(0, MAX_MESSAGE),
    })
    if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES)
    saveTimer ??= setTimeout(saveLog, 500)
    if (logPre) logPre.textContent = logText(entries)
  }

  const log = (level: RescueLevel, message: string, detail?: unknown) => {
    const line =
      detail === undefined ? message : `${message}: ${describe(detail)}`
    record(level, line)
    if (detail === undefined) original[level](`[editor] ${message}`)
    else original[level](`[editor] ${message}`, detail)
  }

  // Whatever the app or a library reports lands in the log too.
  for (const level of ['warn', 'error'] as const) {
    const before = console[level]
    console[level] = (...args: Array<unknown>) => {
      record(level, args.map(describe).join(' '))
      original[level](...args)
    }
    undo.push(() => {
      console[level] = before
    })
  }

  listen('pagehide', saveLog)
  record('info', `Page loaded: ${location.pathname} (version ${info.version})`)

  /* ---------------- Errors ---------------- */

  const appUp = () => !!document.querySelector(READY)
  let wasUp = false
  let lastError: unknown

  const isBenign = (message: string, source = '') =>
    // Layout noise that browsers report as an error but that breaks nothing.
    /ResizeObserver loop/.test(message) ||
    // Browser extensions running in the page.
    /^(chrome|moz|safari|safari-web)-extension:/.test(source) ||
    // A cross-origin script hid what happened; nothing to show.
    message === 'Script error.'

  const problem = (error: unknown) => {
    lastError = error
    const up = wasUp
    setTimeout(
      () => {
        if (appUp()) {
          wasUp = true
          toast(error)
        } else open({ error, kind: 'fatal', auto: true })
      },
      // A render error clears the page as it's reported; give it a moment.
      up ? 300 : GRACE_MS,
    )
  }

  listen(
    'error',
    (event) => {
      const target = event.target as Element | null
      if (target && target !== (window as unknown) && 'tagName' in target) {
        // A script or stylesheet that failed to download.
        const tag = target.tagName.toLowerCase()
        if (tag !== 'script' && tag !== 'link') return
        const url =
          (target as HTMLScriptElement).src || (target as HTMLLinkElement).href
        // Only the editor's own files matter. A third-party script, like the
        // analytics beacon, is often blocked by the browser or an extension
        // for privacy, and the editor works fine without it.
        let ours = false
        try {
          ours = new URL(url, location.href).origin === location.origin
        } catch {
          // Not a URL; treat it as someone else's.
        }
        if (!ours) {
          record('info', `Could not load ${url} (not part of the editor)`)
          return
        }
        log('error', `Could not load ${url}`)
        problem(new Error(`Could not load ${url}`))
        return
      }
      const error: unknown = event.error ?? event.message
      const message = describe(error)
      const where = event.filename
        ? ` (${event.filename}:${event.lineno}:${event.colno})`
        : ''
      record('error', `Uncaught ${message}${where}`)
      if (!isBenign(event.message || message, event.filename)) problem(error)
    },
    true,
  )

  listen('unhandledrejection', (event) => {
    const reason: unknown = event.reason
    const message = describe(reason)
    record('error', `Unhandled rejection: ${message}`)
    if (!isBenign(message)) problem(reason)
  })

  /* ---------------- DOM helpers ---------------- */

  const el = <TTag extends keyof HTMLElementTagNameMap>(
    tag: TTag,
    className = '',
    content?: string | Array<Node | null>,
  ) => {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (typeof content === 'string') node.textContent = content
    else if (content)
      for (const child of content) if (child) node.appendChild(child)
    return node
  }

  const BUTTON =
    'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-medium whitespace-nowrap outline-none select-none focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50'
  const LOOKS = {
    primary:
      'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
    outline:
      'border-border bg-background hover:bg-muted dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
    destructive:
      'border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30',
  }

  const button = (
    label: string,
    look: keyof typeof LOOKS,
    run: (button: HTMLButtonElement) => unknown,
  ) => {
    const node = el('button', `${BUTTON} ${LOOKS[look]}`, label)
    node.type = 'button'
    node.addEventListener('click', () => {
      void Promise.resolve()
        .then(() => run(node))
        .catch((error: unknown) => log('error', `${label} failed`, error))
    })
    return node
  }

  const whenBody = (run: () => void) => {
    // Null while the script runs in the head.
    if ((document.body as HTMLElement | null) !== null) run()
    else document.addEventListener('DOMContentLoaded', run, { once: true })
  }

  const save = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob)
    const link = el('a')
    link.href = url
    link.download = name
    document.body.appendChild(link)
    link.click()
    link.remove()
    // Revoking during the click can cancel the download in Firefox and Safari.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const fill = (template: string, values: Record<string, string>) =>
    template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

  const today = () => new Date().toISOString().slice(0, 10)

  /* ---------------- Stored data ---------------- */

  /** Every row of the workspace database, by store, read without the app. */
  const readStores = () =>
    new Promise<Stores>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('IndexedDB did not answer within 10 seconds')),
        10_000,
      )
      const settle =
        <T>(fn: (value: T) => void) =>
        (value: T) => {
          clearTimeout(timer)
          fn(value)
        }
      let request: IDBOpenDBRequest
      try {
        request = indexedDB.open(DB_NAME)
      } catch (error) {
        settle(reject)(error)
        return
      }
      // No database yet: don't create one, there's nothing to read.
      request.onupgradeneeded = () => request.transaction?.abort()
      request.onerror = () =>
        request.error?.name === 'AbortError'
          ? settle(resolve)({})
          : settle(reject)(request.error)
      request.onsuccess = () => {
        const db = request.result
        const names = [...db.objectStoreNames].filter((n) => n !== '_versions')
        if (!names.length) {
          db.close()
          settle(resolve)({})
          return
        }
        const out: Stores = {}
        const transaction = db.transaction(names, 'readonly')
        for (const name of names) {
          const all = transaction.objectStore(name).getAll()
          all.onsuccess = () => {
            out[name] = all.result as Array<Row>
          }
        }
        transaction.oncomplete = () => {
          db.close()
          settle(resolve)(out)
        }
        transaction.onerror = transaction.onabort = () => {
          db.close()
          settle(reject)(transaction.error)
        }
      }
    })

  const snapshot = (storage: () => Storage) => {
    const out: Record<string, string> = {}
    try {
      const store = storage()
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i)
        if (key && key !== LOG_KEY) out[key] = store.getItem(key) ?? ''
      }
    } catch {
      // Storage is off.
    }
    return out
  }

  let stores: Promise<Stores> | undefined
  /** The stored rows, read once per screen; a failed read is tried again. */
  const storedRows = () => {
    stores ??= readStores().catch((error: unknown) => {
      stores = undefined
      throw error
    })
    return stores
  }

  /** The same shape as the editor's own backups, so Restore takes it. */
  const backup = (rows: Stores) => {
    const out: Record<string, unknown> = {
      app: DB_NAME,
      version: 1,
      exportedAt: new Date().toISOString(),
    }
    for (const name of COLLECTIONS) out[name] = rows[name] ?? []
    out.browserStorage = {
      local: snapshot(() => localStorage),
      session: snapshot(() => sessionStorage),
    }
    return out
  }

  const crcTable = () => {
    const table = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c >>> 0
    }
    return table
  }

  /** An uncompressed zip of `files`. */
  const zip = (files: Array<{ name: string; data: Uint8Array }>) => {
    const table = crcTable()
    const encoder = new TextEncoder()
    const now = new Date()
    const time =
      (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
    const date =
      ((now.getFullYear() - 1980) << 9) |
      ((now.getMonth() + 1) << 5) |
      now.getDate()
    const parts: Array<Uint8Array> = []
    const central: Array<Uint8Array> = []
    let offset = 0
    for (const file of files) {
      const name = encoder.encode(file.name)
      let crc = 0xffffffff
      for (const byte of file.data)
        crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
      crc = (crc ^ 0xffffffff) >>> 0
      const size = file.data.length
      const local = new DataView(new ArrayBuffer(30))
      local.setUint32(0, 0x04034b50, true)
      local.setUint16(4, 20, true)
      // Names are UTF-8.
      local.setUint16(6, 0x0800, true)
      local.setUint16(10, time, true)
      local.setUint16(12, date, true)
      local.setUint32(14, crc, true)
      local.setUint32(18, size, true)
      local.setUint32(22, size, true)
      local.setUint16(26, name.length, true)
      parts.push(new Uint8Array(local.buffer), name, file.data)
      const entry = new DataView(new ArrayBuffer(46))
      entry.setUint32(0, 0x02014b50, true)
      entry.setUint16(4, 20, true)
      entry.setUint16(6, 20, true)
      entry.setUint16(8, 0x0800, true)
      entry.setUint16(12, time, true)
      entry.setUint16(14, date, true)
      entry.setUint32(16, crc, true)
      entry.setUint32(20, size, true)
      entry.setUint32(24, size, true)
      entry.setUint16(28, name.length, true)
      entry.setUint32(42, offset, true)
      central.push(new Uint8Array(entry.buffer), name)
      offset += 30 + name.length + size
    }
    const centralSize = central.reduce((sum, part) => sum + part.length, 0)
    const end = new DataView(new ArrayBuffer(22))
    end.setUint32(0, 0x06054b50, true)
    end.setUint16(8, files.length, true)
    end.setUint16(10, files.length, true)
    end.setUint32(12, centralSize, true)
    end.setUint32(16, offset, true)
    return new Blob(
      [...parts, ...central, new Uint8Array(end.buffer)] as Array<BlobPart>,
      {
        type: 'application/zip',
      },
    )
  }

  /** Each stored file as a zip entry, in its folder; deleted ones apart. */
  const fileEntries = (rows: Stores) => {
    const folders = new Map(
      (rows.folders ?? []).map((folder) => [String(folder.id), folder]),
    )
    const folderPath = (id: unknown) => {
      const names: Array<string> = []
      const seen = new Set<unknown>()
      let folder = folders.get(String(id))
      while (folder && !seen.has(folder.id)) {
        seen.add(folder.id)
        names.unshift(String(folder.name))
        folder = folders.get(String(folder.parentId))
      }
      return names
    }
    const clean = (part: string) =>
      part.replace(/[\\:*?"<>|]/g, '_').replace(/^\.+$/, '_') || '_'
    const used = new Set<string>()
    const unique = (path: string) => {
      let candidate = path
      for (let n = 2; used.has(candidate.toLowerCase()); n++) {
        const dot = path.lastIndexOf('.')
        const slash = path.lastIndexOf('/')
        candidate =
          dot > slash + 1
            ? `${path.slice(0, dot)} (${n})${path.slice(dot)}`
            : `${path} (${n})`
      }
      used.add(candidate.toLowerCase())
      return candidate
    }
    const encoder = new TextEncoder()
    return (rows.files ?? []).flatMap((file) => {
      if (typeof file.content !== 'string') return []
      const location = file.location as { path?: unknown } | undefined
      const parts =
        typeof location?.path === 'string'
          ? location.path.split('/')
          : [...folderPath(file.folderId), String(file.name || 'untitled')]
      if (file.deletedAt !== null && file.deletedAt !== undefined)
        parts.unshift(text.deletedFolder)
      const name = unique(parts.filter(Boolean).map(clean).join('/'))
      const image = /^data:[^;,]+;base64,/.exec(file.content)
      let data: Uint8Array
      if (image) {
        const binary = atob(file.content.slice(image[0].length))
        data = Uint8Array.from(binary, (char) => char.charCodeAt(0))
      } else data = encoder.encode(file.content)
      return [{ name, data }]
    })
  }

  /* ---------------- Report ---------------- */

  const logText = (list: Array<RescueEntry>) =>
    list
      .map((entry) => {
        const at = new Date(entry.time)
          .toISOString()
          .replace('T', ' ')
          .slice(0, 19)
        return `${at} ${entry.level.padEnd(5)} ${entry.message}`
      })
      .join('\n') || text.logEmpty

  const size = (bytes: number) =>
    bytes < 1024 ** 2
      ? `${Math.round(bytes / 1024)} kB`
      : bytes < 1024 ** 3
        ? `${(bytes / 1024 ** 2).toFixed(1)} MB`
        : `${(bytes / 1024 ** 3).toFixed(1)} GB`

  const storageSummary = async () => {
    const lines: Array<string> = []
    try {
      const rows = await storedRows()
      for (const name of COLLECTIONS) {
        const list = rows[name] ?? []
        if (name !== 'files') {
          lines.push(`${name}: ${list.length}`)
          continue
        }
        const chars = list.reduce(
          (sum, file) =>
            sum + (typeof file.content === 'string' ? file.content.length : 0),
          0,
        )
        const deleted = list.filter((file) => file.deletedAt != null).length
        const closed = list.filter((file) => file.closed === true).length
        lines.push(
          `files: ${list.length} (${deleted} deleted, ${closed} closed), ${size(chars)} of text`,
        )
      }
      const other = Object.keys(rows).filter(
        (name) => !COLLECTIONS.includes(name),
      )
      if (other.length) lines.push(`other stores: ${other.join(', ')}`)
    } catch (error) {
      lines.push(`Could not read IndexedDB: ${describe(error)}`)
    }
    try {
      const estimate = await navigator.storage.estimate()
      const persisted = await navigator.storage.persisted()
      lines.push(
        `browser storage: ${size(estimate.usage ?? 0)} used of ${size(estimate.quota ?? 0)}, ${persisted ? 'persistent' : 'not persistent'}`,
      )
    } catch {
      // No Storage API.
    }
    return lines.join('\n')
  }

  const settingsText = () => {
    const lines: Array<string> = []
    for (const [area, values] of [
      ['localStorage', snapshot(() => localStorage)],
      ['sessionStorage', snapshot(() => sessionStorage)],
    ] as const) {
      for (const [key, value] of Object.entries(values)) {
        const short =
          value.length > 600
            ? `${value.slice(0, 600)}… (${value.length} chars)`
            : value
        lines.push(`${area} ${key} = ${short}`)
      }
    }
    return lines.join('\n') || '(none)'
  }

  const errorText = (error: unknown) =>
    error === undefined
      ? ''
      : describe(error).split('\n').slice(0, 25).join('\n')

  const report = (
    kind: RescueKind,
    error: unknown,
    summary: string,
    list: Array<RescueEntry>,
  ) =>
    [
      `Editor ${info.version}, ${location.origin}${location.pathname}`,
      `Screen: ${kind}`,
      `Time: ${new Date().toISOString()}, ${Math.round((Date.now() - started) / 1000)} s after the page loaded`,
      `Browser: ${navigator.userAgent}`,
      `Language: ${navigator.language}, window ${innerWidth}×${innerHeight}`,
      '',
      '## Error',
      errorText(error) || '(none caught)',
      '',
      '## Stored data',
      summary || '(not read yet)',
      '',
      '## Settings in this browser',
      settingsText(),
      '',
      '## Log, oldest first',
      logText(list),
    ].join('\n')

  /** A link that opens the chat with as much of the report as fits. */
  const aiUrl = (
    base: string,
    problemText: string,
    kind: RescueKind,
    error: unknown,
    summary: string,
  ) => {
    let list = entries.slice(-80)
    for (;;) {
      const prompt = fill(text.aiPrompt, {
        url: location.origin,
        problem: problemText,
        report: report(kind, error, summary, list),
      })
      const url = base + encodeURIComponent(prompt)
      if (url.length <= MAX_AI_URL) return url
      if (list.length) list = list.slice(Math.ceil(list.length / 4))
      else {
        // Even without a log: keep the start, which says what broke.
        let cut = prompt.length
        let short = url
        while (short.length > MAX_AI_URL && cut > 0) {
          cut = Math.floor(cut * 0.8)
          short = base + encodeURIComponent(`${prompt.slice(0, cut)}…`)
        }
        return short
      }
    }
  }

  /* ---------------- Toast ---------------- */

  /** Tells the app of an error it didn't catch, or says so itself. */
  const toast = (error: unknown) => {
    const message = errorText(error).split('\n')[0] ?? ''
    const unhandled = window.dispatchEvent(
      new CustomEvent(ERROR_EVENT, {
        cancelable: true,
        detail: { message, error },
      }),
    )
    if (!unhandled || panel) return
    whenBody(() => {
      toastNode?.remove()
      const node: HTMLDivElement = el(
        'div',
        'fixed right-4 bottom-4 z-[2147483646] flex max-w-sm items-center gap-3 rounded-lg border bg-background p-3 text-xs text-foreground shadow-lg',
        [
          el('div', 'grid min-w-0 gap-0.5', [
            el('span', 'font-medium', text.unexpected),
            el('span', 'truncate text-muted-foreground', message),
          ]),
          button(text.details, 'outline', () => {
            node.remove()
            open({ error, kind: 'manual' })
          }),
          button(text.close, 'outline', () => node.remove()),
        ],
      )
      node.setAttribute('role', 'alert')
      node.style.cssText =
        'position:fixed;right:16px;bottom:16px;z-index:2147483646'
      toastNode = node
      document.body.appendChild(node)
    })
  }

  /* ---------------- Screen ---------------- */

  const close = () => {
    releaseFocus?.()
    releaseFocus = undefined
    panel?.remove()
    panel = undefined
    logPre = undefined
    stores = undefined
  }

  const SEVERITY: Record<RescueKind, number> = {
    manual: 0,
    stuck: 1,
    blocked: 2,
    fatal: 3,
  }

  function open(options: RescueOpenOptions = {}) {
    const kind = options.kind ?? 'manual'
    const error = options.error ?? (kind === 'manual' ? undefined : lastError)
    if (options.error !== undefined) lastError = options.error
    // An open screen only gives way to a more serious one.
    if (
      panel &&
      SEVERITY[kind] <= SEVERITY[panelKind] &&
      options.error === undefined
    )
      return
    whenBody(() => render(kind, error, options.auto ?? false))
  }

  function render(kind: RescueKind, error: unknown, auto: boolean) {
    close()
    toastNode?.remove()
    panelKind = kind
    panelAuto = auto
    log(kind === 'manual' ? 'info' : 'warn', `Recovery screen shown (${kind})`)

    const titles: Record<RescueKind, [string, string]> = {
      fatal: [text.titleFatal, text.bodyFatal],
      stuck: [text.titleStuck, text.bodyStuck],
      blocked: [text.titleBlocked, text.bodyBlocked],
      manual: [text.titleManual, text.bodyManual],
    }
    const [title, body] = titles[kind]
    const lastInfo = [...entries]
      .reverse()
      .find((entry) => entry.level === 'info')
    const shownError =
      errorText(error) ||
      (kind === 'stuck' && lastInfo
        ? fill(text.lastStep, { step: lastInfo.message })
        : '')

    const status = el('p', '-mt-4 text-xs text-muted-foreground empty:hidden')
    status.setAttribute('role', 'status')
    const say = (message: string) => {
      status.textContent = message
    }

    const downloadBackup = async () => {
      let rows: Stores = {}
      let failure: unknown
      try {
        rows = await storedRows()
      } catch (readError) {
        failure = readError
        log('error', 'Could not read IndexedDB for the backup', readError)
      }
      const name = fill(text.backupName, { date: today() })
      save(
        new Blob([JSON.stringify(backup(rows), null, 2)], {
          type: 'application/json',
        }),
        name,
      )
      log(
        'info',
        `Recovery backup downloaded (${(rows.files ?? []).length} files)`,
      )
      say(
        failure === undefined
          ? fill(text.backupDone, { name })
          : fill(text.readFailed, {
              error: describe(failure).split('\n')[0] ?? '',
            }),
      )
      return failure === undefined
    }

    const downloadFiles = async () => {
      let rows: Stores
      try {
        rows = await storedRows()
      } catch (readError) {
        log('error', 'Could not read IndexedDB for the files', readError)
        say(
          fill(text.readFailed, {
            error: describe(readError).split('\n')[0] ?? '',
          }),
        )
        return
      }
      const files = fileEntries(rows)
      if (!files.length) {
        say(text.noFiles)
        return
      }
      const name = fill(text.filesName, { date: today() })
      save(zip(files), name)
      log('info', `Recovery zip downloaded (${files.length} files)`)
      say(fill(text.filesDone, { name }))
    }

    // What broke, in the words of the screen; the report has the rest.
    const problemText =
      kind !== 'manual'
        ? `${title}.`
        : error === undefined
          ? ''
          : `${text.unexpected}.`
    const links = AI.map(([key, base]) => {
      const link = el('a', `${BUTTON} ${LOOKS.outline}`, text[key])
      link.href = aiUrl(base, problemText, kind, error, '')
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      return { link, base }
    })
    let summary = ''
    void storageSummary().then((value) => {
      summary = value
      for (const { link, base } of links)
        link.href = aiUrl(base, problemText, kind, error, summary)
    })

    const copy = async () => {
      const full = report(kind, error, summary, entries)
      try {
        await navigator.clipboard.writeText(full)
        say(text.copied)
      } catch {
        const area = el('textarea')
        area.value = full
        area.style.cssText = 'position:fixed;opacity:0'
        document.body.appendChild(area)
        area.select()
        const done = document.execCommand('copy')
        area.remove()
        say(done ? text.copied : text.copyFailed)
      }
    }

    const reload = () => {
      saveLog()
      const url = new URL(location.href)
      url.searchParams.delete('rescue')
      location.replace(url.href)
    }

    const clearStorage = (keep: (key: string) => boolean) => {
      for (const storage of [() => localStorage, () => sessionStorage]) {
        try {
          const store = storage()
          const keys: Array<string> = []
          for (let i = 0; i < store.length; i++) {
            const key = store.key(i)
            if (key?.startsWith(PREFIX) && !keep(key)) keys.push(key)
          }
          for (const key of keys) store.removeItem(key)
        } catch {
          // Storage is off; nothing kept there to clear.
        }
      }
    }

    const resetLayout = () => {
      log('warn', 'Layout and preferences reset from the recovery screen')
      // Rows older versions kept in localStorage are files, not layout.
      clearStorage((key) => COLLECTIONS.includes(key.slice(PREFIX.length)))
      reload()
    }

    const erase = async (node: HTMLButtonElement) => {
      if (!window.confirm(text.eraseConfirm)) return
      node.disabled = true
      const backedUp = await downloadBackup()
      if (!backedUp && !window.confirm(text.eraseNoBackup)) {
        node.disabled = false
        return
      }
      log('warn', 'Everything erased from the recovery screen')
      clearStorage(() => false)
      stores = undefined
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(DB_NAME)
        request.onsuccess = request.onerror = () => resolve()
        request.onblocked = () => say(text.eraseBlocked)
      })
      reload()
    }

    const section = (heading: string, children: Array<Node | null>) =>
      el('section', 'grid gap-2', [
        el('h2', 'text-sm font-medium', heading),
        el('div', 'flex flex-wrap gap-2', children),
      ])

    logPre = el(
      'pre',
      'mt-2 max-h-72 overflow-auto rounded-md border bg-muted p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all',
      logText(entries),
    )
    const heading = el(
      'h1',
      'text-xl font-semibold tracking-tight outline-none',
      title,
    )
    heading.id = 'editor-rescue-title'
    heading.tabIndex = -1

    const closable = kind !== 'fatal' || appUp()
    const node = el(
      'div',
      'fixed inset-0 z-[2147483647] overflow-y-auto bg-background font-sans text-foreground',
      [
        el('div', 'mx-auto grid max-w-xl gap-6 px-4 py-12 sm:py-20', [
          el('div', 'grid gap-2', [
            heading,
            el('p', 'text-sm text-muted-foreground', body),
          ]),
          shownError
            ? el(
                'pre',
                'max-h-48 overflow-auto rounded-md border bg-muted p-3 font-mono text-xs whitespace-pre-wrap break-words',
                shownError,
              )
            : null,
          section(text.keepData, [
            button(text.downloadBackup, 'primary', downloadBackup),
            button(text.downloadFiles, 'outline', downloadFiles),
          ]),
          status,
          section(text.getHelp, [
            ...links.map(({ link }) => link),
            button(text.copyDetails, 'outline', copy),
          ]),
          el('p', '-mt-4 text-xs text-muted-foreground', text.helpNote),
          section(text.tryAgain, [
            button(text.reload, 'outline', reload),
            button(text.resetLayout, 'outline', resetLayout),
            button(text.erase, 'destructive', erase),
          ]),
          el('p', '-mt-4 text-xs text-muted-foreground', text.resetNote),
          el('details', 'text-xs', [
            el('summary', 'cursor-pointer font-medium', text.showLog),
            logPre,
          ]),
          closable
            ? el('div', 'flex', [
                button(
                  kind === 'stuck' ? text.keepWaiting : text.close,
                  'outline',
                  close,
                ),
              ])
            : null,
        ]),
      ],
    )
    node.setAttribute('role', 'alertdialog')
    node.setAttribute('aria-modal', 'true')
    node.setAttribute('aria-labelledby', heading.id)
    node.dataset.editorRescue = kind
    // Usable even when the stylesheet didn't load.
    node.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;overflow-y:auto'
    node.addEventListener('keydown', (event) => {
      // The editor behind has shortcuts of its own.
      event.stopPropagation()
      if (event.key === 'Escape' && closable) close()
    })
    panel = node
    document.body.appendChild(node)
    heading.focus()
    // Keys go to the screen, never to the editor hidden behind it.
    const keepFocus = (event: FocusEvent) => {
      if (!node.contains(event.target as Node | null)) heading.focus()
    }
    document.addEventListener('focusin', keepFocus)
    releaseFocus = () => document.removeEventListener('focusin', keepFocus)
  }

  /* ---------------- Watchdog ---------------- */

  let missingSince = started
  const watchdog = setInterval(() => {
    if (appUp()) {
      wasUp = true
      missingSince = 0
      if (panel && panelAuto) {
        // The app came through after all; what broke still gets said.
        const shown = panelKind
        close()
        if (shown === 'fatal' && lastError !== undefined) toast(lastError)
      }
      return
    }
    missingSince ||= Date.now()
    if (panel) {
      // A render that clears the page takes the screen with it; put it back.
      if (!panel.isConnected) document.body.appendChild(panel)
      return
    }
    if (Date.now() - missingSince >= STUCK_MS && !document.hidden) {
      log(
        'error',
        `Nothing on screen after ${Math.round((Date.now() - missingSince) / 1000)} s`,
      )
      open({ kind: wasUp ? 'fatal' : 'stuck', auto: true })
    }
  }, 1000)

  global.__editorRescue = {
    log,
    open,
    entries: () => entries.slice(),
  }

  if (/[?&]rescue\b/.test(location.search)) open({ kind: 'manual' })

  // For tests and hot reloads; the page itself never takes it down.
  return () => {
    clearInterval(watchdog)
    clearTimeout(saveTimer)
    for (const step of undo) step()
    close()
    toastNode?.remove()
    delete global.__editorRescue
  }
}
