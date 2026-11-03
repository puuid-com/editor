import { beforeAll, describe, expect, it } from 'vitest'
import {
  detectLanguage,
  formatDocument,
  languageOf,
  parseDocument,
  typedName,
} from '#/lib/document'
import {
  createFile,
  filesCollection,
  saveContent,
  saveZplSettings,
  closeFile,
  restoreFile,
} from '#/lib/store/files'
import { workspaceReady } from '#/lib/store/workspace'
import { settleWrites } from '#/lib/store/persist'
import { createBackup, parseBackup } from '#/lib/store/backup'
import { decodeShare, encodeShare } from '#/lib/share'
import { normalizeSettings } from './schema'

beforeAll(() => workspaceReady())
const source = '^XA^FO30,30^FDHello^FS^XZ'
const settings = { dpmm: 12 as const, widthIn: 3, heightIn: 2 }

describe('ZPL in the shared workspace', () => {
  it('detects file extensions and pasted ZPL without interpreting XML label data', () => {
    expect(languageOf('LABEL.ZPL', '')).toBe('zpl')
    expect(detectLanguage(source)).toBe('zpl')
    expect(languageOf('label.txt', source)).toBe('zpl')
    expect(languageOf('data.xml', '<label>^XA^XZ</label>')).toBe('xml')
    expect(typedName('label.json', 'zpl')).toBe('label.zpl')
    expect(parseDocument(source, 'zpl').errors).toEqual([])
    expect(formatDocument(source, 'zpl', {})).toEqual({
      ok: true,
      text: source,
    })
  })
  it('preserves settings when they change during a paced content save, archive and restore', async () => {
    const file = createFile('label.zpl', source)
    await settleWrites()
    saveContent({ id: file.id, content: source + '\n' })
    saveZplSettings(file.id, settings)
    await closeFile(file.id)
    await restoreFile(file.id)
    expect(filesCollection.get(file.id)).toMatchObject({
      content: source + '\n',
      zplSettings: settings,
      deletedAt: null,
    })
    const result = parseBackup(JSON.stringify(createBackup()))
    expect(
      result.ok &&
        result.backup.files.find((f) => f.id === file.id)?.zplSettings,
    ).toEqual(settings)
  })
  it('includes label settings in shared files and continues reading old links', async () => {
    const file = { name: 'label.zpl', content: source, zplSettings: settings }
    expect(await decodeShare(await encodeShare(file))).toEqual(file)
    expect(
      await decodeShare(await encodeShare({ name: 'a.xml', content: '<a/>' })),
    ).toEqual({ name: 'a.xml', content: '<a/>' })
  })
  it('bounds legacy URL settings independently, preserving valid dimensions', () => {
    expect(normalizeSettings({ dpmm: 7, widthIn: 2, heightIn: -1 })).toEqual({
      dpmm: 8,
      widthIn: 2,
      heightIn: 6,
    })
  })
})
