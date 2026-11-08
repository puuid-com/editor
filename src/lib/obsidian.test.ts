import { describe, expect, it } from 'vitest'

import {
  embedSize,
  hrefPath,
  isAttachmentFolder,
  isExcluded,
  isLocalHref,
  noteName,
  noteSection,
  parseVaultSettings,
  parseWikilink,
  readVault,
  linkResolver,
  wikilinkText,
} from './obsidian'
import { fakeFolder } from '#/test/fake-fs'

describe('vault settings', () => {
  it('reads the attachment folder and excluded files', () => {
    expect(
      parseVaultSettings(
        JSON.stringify({
          attachmentFolderPath: '/Attachments/',
          userIgnoreFilters: ['Archive/', ' ', '/\\.draft\\.md$/'],
        }),
      ),
    ).toEqual({
      attachments: 'Attachments',
      excluded: ['Archive/', '/\\.draft\\.md$/'],
    })
  })

  it('has no attachment folder when they go at the root or beside notes', () => {
    for (const folder of ['/', '', './', './assets'])
      expect(
        parseVaultSettings(JSON.stringify({ attachmentFolderPath: folder }))
          .attachments,
      ).toBe('')
  })

  it('falls back to defaults for missing or broken settings', () => {
    const defaults = { attachments: '', excluded: [] }
    expect(parseVaultSettings(undefined)).toEqual(defaults)
    expect(parseVaultSettings('{not json')).toEqual(defaults)
    expect(parseVaultSettings('[]')).toEqual(defaults)
    expect(parseVaultSettings('{"userIgnoreFilters": "x"}')).toEqual(defaults)
  })

  it('tells a vault by its .obsidian folder', async () => {
    const vault = fakeFolder('notes', {
      '.obsidian': { 'app.json': '{"attachmentFolderPath":"assets"}' },
      'a.md': '',
    })
    expect(await readVault(vault.handle)).toEqual({
      attachments: 'assets',
      excluded: [],
    })
    const fresh = fakeFolder('notes', { '.obsidian': {} })
    expect(await readVault(fresh.handle)).toEqual({
      attachments: '',
      excluded: [],
    })
    expect(await readVault(fakeFolder('src', { 'a.xml': '' }).handle)).toBe(
      null,
    )
    // A file of that name isn't a vault's settings.
    expect(
      await readVault(fakeFolder('src', { '.obsidian': 'x' }).handle),
    ).toBe(null)
  })

  it('hides the attachment folder and leaves excluded files out of search', () => {
    const vault = {
      attachments: 'Assets',
      excluded: ['Archive/', '/^daily\\//', '/', '/(/'],
    }
    expect(isAttachmentFolder(vault, 'assets')).toBe(true)
    expect(isAttachmentFolder(vault, 'Assets/old')).toBe(false)
    expect(isAttachmentFolder(null, 'Assets')).toBe(false)
    expect(isExcluded(vault, 'Archive/old.md')).toBe(true)
    expect(isExcluded(vault, 'daily/2026-11-07.md')).toBe(true)
    expect(isExcluded(vault, 'notes/daily/x.md')).toBe(false)
    expect(isExcluded(vault, 'Ideas.md')).toBe(false)
    expect(isExcluded(null, 'Archive/old.md')).toBe(false)
  })

  it('names new notes as Markdown', () => {
    expect(noteName(' Ideas ')).toBe('Ideas.md')
    expect(noteName('v1.2 plan')).toBe('v1.2 plan.md')
    expect(noteName('Ideas.md')).toBe('Ideas.md')
    expect(noteName('data.json')).toBe('data.json')
  })
})

describe('wikilinks', () => {
  it('splits target, heading and alias', () => {
    expect(parseWikilink('Note')).toEqual({ target: 'Note' })
    expect(parseWikilink('Note#Plan|the plan')).toEqual({
      target: 'Note',
      heading: 'Plan',
      alias: 'the plan',
    })
    expect(parseWikilink('#Plan')).toEqual({ target: '', heading: 'Plan' })
    expect(parseWikilink('Note\\|alias')).toEqual({
      target: 'Note',
      alias: 'alias',
    })
  })

  it('reads as the alias, else the note and heading', () => {
    expect(wikilinkText({ target: 'Note', alias: 'here' })).toBe('here')
    expect(wikilinkText({ target: 'Note', heading: 'Plan' })).toBe(
      'Note > Plan',
    )
    expect(wikilinkText({ target: '', heading: 'Plan' })).toBe('Plan')
  })

  it('reads an embed size', () => {
    expect(embedSize('300')).toEqual({ width: 300 })
    expect(embedSize('300x200')).toEqual({ width: 300, height: 200 })
    expect(embedSize('caption')).toBeUndefined()
    expect(embedSize(undefined)).toBeUndefined()
  })
})

describe('resolving links', () => {
  const resolveLink = (target: string, from: string, paths: Array<string>) =>
    linkResolver(paths)(target, from)
  const paths = [
    'Home.md',
    'Projects/Plan.md',
    'Projects/Ideas.md',
    'Archive/Plan.md',
    'Archive/2025/Ideas.md',
    'assets/diagram.png',
    'Projects/assets/diagram.png',
  ]

  it('finds notes by name anywhere, without .md and ignoring case', () => {
    expect(resolveLink('home', 'Projects/Plan.md', paths)).toBe('Home.md')
    expect(resolveLink('Ideas', 'Home.md', paths)).toBe('Projects/Ideas.md')
    expect(resolveLink('Missing', 'Home.md', paths)).toBeUndefined()
    expect(resolveLink('  ', 'Home.md', paths)).toBeUndefined()
  })

  it('prefers the note beside the linking one, then the nearest', () => {
    expect(resolveLink('Plan', 'Archive/2025/Ideas.md', paths)).toBe(
      'Archive/Plan.md',
    )
    expect(resolveLink('Plan', 'Projects/Ideas.md', paths)).toBe(
      'Projects/Plan.md',
    )
    expect(resolveLink('diagram.png', 'Projects/Plan.md', paths)).toBe(
      'Projects/assets/diagram.png',
    )
    expect(resolveLink('diagram.png', 'Home.md', paths)).toBe(
      'assets/diagram.png',
    )
  })

  it('follows relative, root and partial paths', () => {
    expect(resolveLink('../Home', 'Projects/Plan.md', paths)).toBe('Home.md')
    expect(resolveLink('./Ideas.md', 'Projects/Plan.md', paths)).toBe(
      'Projects/Ideas.md',
    )
    expect(resolveLink('/assets/diagram.png', 'Projects/Plan.md', paths)).toBe(
      'assets/diagram.png',
    )
    expect(resolveLink('2025/Ideas', 'Home.md', paths)).toBe(
      'Archive/2025/Ideas.md',
    )
    // Above the vault there is nothing to find.
    expect(resolveLink('../../Home', 'Projects/Plan.md', paths)).toBeUndefined()
  })

  it('tells local links from sites and reads their path', () => {
    expect(isLocalHref('Other%20note.md')).toBe(true)
    expect(isLocalHref('../img.png')).toBe(true)
    expect(isLocalHref('#plan')).toBe(false)
    expect(isLocalHref('https://example.com')).toBe(false)
    expect(isLocalHref('obsidian://open?vault=x')).toBe(false)
    expect(isLocalHref('//cdn.example.com/a.png')).toBe(false)
    expect(isLocalHref('')).toBe(false)
    expect(hrefPath('Other%20note.md#Plan')).toBe('Other note.md')
    expect(hrefPath('100%.md')).toBe('100%.md')
  })
})

describe('embedded notes', () => {
  const note = [
    '---',
    'tags: [a]',
    '---',
    '# Plan',
    'Intro',
    '## Steps',
    '```md',
    '# Not a heading',
    '```',
    'Do it ^step',
    '### Detail',
    'More',
    '## Done',
    'End',
  ].join('\n')

  it('shows the whole note without its frontmatter', () => {
    expect(noteSection(note)?.startsWith('# Plan')).toBe(true)
  })

  it('shows a heading and what is under it, past code and deeper headings', () => {
    expect(noteSection(note, 'steps')).toBe(
      '## Steps\n```md\n# Not a heading\n```\nDo it ^step\n### Detail\nMore',
    )
    expect(noteSection(note, 'Plan#Done')).toBe('## Done\nEnd')
    expect(noteSection(note, 'Nowhere')).toBeNull()
  })

  it('shows the paragraph a block id marks, without the id', () => {
    expect(noteSection('a\n\nb\nc ^x\n\nd', '^x')).toBe('b\nc')
    expect(noteSection('a', '^x')).toBeNull()
  })
})
