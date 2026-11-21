import { unzipSync, strFromU8 } from 'fflate'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { onUncaughtError } from './client'
import { rescueScript } from './script'
import { parseBackup } from '#/lib/store/backup'
import { archiveFile, createFile, filesCollection } from '#/lib/store/files'
import { settleWrites } from '#/lib/store/persist'
import { workspaceReady } from '#/lib/store/workspace'
import { appVersion } from '#/lib/version'
import { m } from '#/paraglide/messages'

// The script as the server sends it, run from its text alone: anything it
// reached outside its own body would be missing here.
function install() {
  const teardown = new Function(`return ${rescueScript()}`)() as () => void
  return teardown
}

let teardown: (() => void) | undefined
const downloads: Array<{ name: string; blob: Blob }> = []

beforeAll(() => workspaceReady())

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  downloads.length = 0
  URL.createObjectURL = (blob: Blob) => {
    downloads.push({ name: '', blob })
    return `blob:${downloads.length}`
  }
  URL.revokeObjectURL = () => {}
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    const download = downloads.at(-1)
    if (download && this.download) download.name = this.download
  })
})

afterEach(() => {
  teardown?.()
  teardown = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
  history.replaceState(null, '', '/')
})

const screen = () => document.querySelector<HTMLElement>('[data-editor-rescue]')
const buttonNamed = (name: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent === name)
const linkNamed = (name: string) =>
  [...document.querySelectorAll('a')].find((a) => a.textContent === name)

function showApp() {
  const app = document.createElement('div')
  app.setAttribute('data-app-ready', '')
  document.body.appendChild(app)
  return app
}

function throwUncaught(error: Error) {
  window.dispatchEvent(
    new ErrorEvent('error', { error, message: error.message }),
  )
}

describe('the recovery script', () => {
  it('escapes everything that could end its script tag', () => {
    expect(rescueScript()).not.toMatch(/<\/script/i)
  })

  it('installs itself once and takes itself down', () => {
    teardown = install()
    expect(window.__editorRescue).toBeDefined()
    expect(install()).toBeUndefined()
    teardown()
    teardown = undefined
    expect(window.__editorRescue).toBeUndefined()
  })

  it('logs console errors and uncaught errors, and keeps them across reloads', () => {
    vi.useFakeTimers()
    // Quiet, and wrapped by the script like the real console.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    teardown = install()
    console.error('library failure', new Error('bad row'))
    throwUncaught(new Error('kaput'))
    vi.advanceTimersByTime(600)
    const stored = JSON.parse(
      localStorage.getItem('editor-log') ?? '[]',
    ) as Array<{
      message: string
    }>
    const messages = stored.map((entry) => entry.message).join('\n')
    expect(messages).toContain('library failure Error: bad row')
    expect(messages).toContain('Uncaught Error: kaput')
  })
})

describe('the recovery screen', () => {
  it('shows when the editor never appears, and leaves when it does', () => {
    vi.useFakeTimers()
    teardown = install()
    window.__editorRescue?.log('info', 'Opening the workspace database')
    vi.advanceTimersByTime(59_000)
    expect(screen()).toBeNull()
    vi.advanceTimersByTime(2000)
    expect(screen()?.dataset.editorRescue).toBe('stuck')
    expect(screen()).toHaveTextContent(m.rescue_title_stuck())
    // Says where loading stopped.
    expect(screen()).toHaveTextContent('Opening the workspace database')
    showApp()
    vi.advanceTimersByTime(1000)
    expect(screen()).toBeNull()
  })

  it('ignores third-party scripts that fail to load, but not its own', () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    teardown = install()
    showApp()
    vi.advanceTimersByTime(1000)
    const failLoad = (src: string) => {
      const script = document.createElement('script')
      script.src = src
      document.body.appendChild(script)
      script.dispatchEvent(new Event('error'))
    }
    failLoad('https://static.cloudflareinsights.com/beacon.min.js/v1')
    vi.advanceTimersByTime(1000)
    expect(document.body).not.toHaveTextContent(m.rescue_details())
    failLoad('/assets/main-abc123.js')
    vi.advanceTimersByTime(1000)
    expect(document.body).toHaveTextContent(m.rescue_details())
  })

  it('takes over when an error wipes the editor off the page', () => {
    vi.useFakeTimers()
    teardown = install()
    const app = showApp()
    vi.advanceTimersByTime(1000)
    throwUncaught(
      new TypeError("Cannot read properties of undefined (reading 'map')"),
    )
    // The runtime clears the page as it reports the error.
    app.remove()
    vi.advanceTimersByTime(300)
    expect(screen()?.dataset.editorRescue).toBe('fatal')
    expect(screen()).toHaveTextContent(m.rescue_title_fatal())
    expect(screen()).toHaveTextContent("reading 'map'")
    // Nothing behind it to go back to.
    expect(buttonNamed(m.rescue_close())).toBeUndefined()
    // A page wiped again after it showed doesn't take it along.
    screen()?.remove()
    vi.advanceTimersByTime(1000)
    expect(screen()).not.toBeNull()
  })

  it('leaves an error to the editor when it is still on screen', () => {
    vi.useFakeTimers()
    teardown = install()
    showApp()
    vi.advanceTimersByTime(1000)
    const heard = vi.fn()
    const stop = onUncaughtError(heard)
    throwUncaught(new Error('a menu failed'))
    vi.advanceTimersByTime(300)
    stop()
    expect(heard).toHaveBeenCalledWith('Error: a menu failed')
    expect(screen()).toBeNull()
    expect(document.querySelector('[role="alert"]')).toBeNull()
  })

  it('says so itself when nothing on the page shows the error', async () => {
    vi.useFakeTimers()
    teardown = install()
    showApp()
    vi.advanceTimersByTime(1000)
    window.dispatchEvent(
      Object.assign(new Event('unhandledrejection'), {
        reason: new Error('lost promise'),
      }),
    )
    vi.advanceTimersByTime(300)
    const toast = document.querySelector('[role="alert"]')
    expect(toast).toHaveTextContent(m.rescue_unexpected())
    expect(toast).toHaveTextContent('lost promise')
    buttonNamed(m.rescue_details())?.click()
    // Buttons act a microtask later.
    await Promise.resolve()
    await Promise.resolve()
    expect(screen()?.dataset.editorRescue).toBe('manual')
  })

  it('ignores layout noise', () => {
    vi.useFakeTimers()
    teardown = install()
    showApp()
    vi.advanceTimersByTime(1000)
    window.dispatchEvent(
      new ErrorEvent('error', {
        message:
          'ResizeObserver loop completed with undelivered notifications.',
      }),
    )
    vi.advanceTimersByTime(300)
    expect(document.querySelector('[role="alert"]')).toBeNull()
  })

  it('keeps keys away from the editor behind it', () => {
    const behind = document.createElement('textarea')
    document.body.appendChild(behind)
    const typed = vi.fn()
    document.addEventListener('keydown', typed)
    history.replaceState(null, '', '/?rescue')
    teardown = install()
    behind.focus()
    expect(document.activeElement?.tagName).toBe('H1')
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
    )
    document.removeEventListener('keydown', typed)
    expect(typed).not.toHaveBeenCalled()
  })

  it('opens from ?rescue', () => {
    history.replaceState(null, '', '/?rescue')
    teardown = install()
    expect(screen()?.dataset.editorRescue).toBe('manual')
    expect(buttonNamed(m.rescue_close())).toBeDefined()
  })
})

describe('what the recovery screen hands back', () => {
  const secret = '<order><card>4111 1111 1111 1111</card></order>'

  beforeEach(async () => {
    const ids = [...filesCollection.keys()]
    if (ids.length) filesCollection.delete(ids)
    createFile('order.xml', secret)
    await archiveFile(createFile('old.json', '{"a":1}').id)
    // Two files of one name, as folders allow: neither may overwrite the other.
    const copy = createFile('copy.xml', '<copy/>')
    filesCollection.update(copy.id, (draft) => {
      draft.name = 'order.xml'
    })
    await settleWrites()
    history.replaceState(null, '', '/?rescue')
    teardown = install()
  })

  async function waitFor<T>(read: () => T | undefined) {
    for (let i = 0; i < 100; i++) {
      const value = read()
      if (value !== undefined) return value
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    throw new Error('Timed out')
  }

  it('a backup the editor can restore', async () => {
    buttonNamed(m.rescue_download_backup())?.click()
    const download = await waitFor(() => downloads.at(-1))
    expect(download.name).toMatch(/^editor-backup-\d{4}-\d{2}-\d{2}\.json$/)
    const parsed = parseBackup(await download.blob.text())
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.backup.files.map((f) => f.content)).toContain(secret)
    expect(parsed.backup.profiles.length).toBeGreaterThan(0)
    await waitFor(() =>
      screen()?.textContent.includes(download.name) ? true : undefined,
    )
  })

  it('every file in a zip, deleted ones apart', async () => {
    buttonNamed(m.rescue_download_files())?.click()
    const download = await waitFor(() => downloads.at(-1))
    expect(download.name).toMatch(/\.zip$/)
    const files = unzipSync(new Uint8Array(await download.blob.arrayBuffer()))
    expect(Object.keys(files).sort()).toEqual(
      [
        `${m.rescue_deleted_folder()}/old.json`,
        'order (2).xml',
        'order.xml',
      ].sort(),
    )
    const contents = Object.values(files).map((data) => strFromU8(data))
    expect(contents).toContain(secret)
  })

  it('help links that describe the problem without the files', async () => {
    const link = linkNamed(m.rescue_ask_claude())
    expect(link?.href).toMatch(/^https:\/\/claude\.ai\/new\?q=/)
    // Filled in once the stored data is counted.
    const prompt = await waitFor(() => {
      const q = new URL(link!.href).searchParams.get('q') ?? ''
      return q.includes('files: 3') ? q : undefined
    })
    expect(prompt).toContain(`Editor ${appVersion}`)
    expect(prompt).not.toContain('4111')
    expect(link!.href.length).toBeLessThanOrEqual(8000)
    expect(linkNamed(m.rescue_ask_chatgpt())?.href).toMatch(
      /^https:\/\/chatgpt\.com\/\?q=/,
    )
  })
})
