import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { FOLD_KEEP, FOLD_OVER, parseChangelog } from './changelog'
import { appVersion } from './version'

describe('parseChangelog', () => {
  it('separates releases without rendering maintenance instructions', () => {
    const entries = parseChangelog(
      `# Changelog\nPrivate maintenance instructions.\n\n## [1.0.0] - 2026-10-28\n\n### Added\n\n- Support \`<<name>>\` variables.\n\n## [0.1.0] - 2026-10-24\n\n- Initial editor.\n`,
    )
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ id: '1.0.0', date: '2026-10-28' })
    expect(entries[0].html).toContain('&lt;&lt;name&gt;&gt;')
    expect(entries[0].html).not.toContain('Initial editor')
    expect(entries[0].html).not.toContain('maintenance')
    expect(entries[1]).toMatchObject({ id: '0.1.0', date: '2026-10-24' })
    expect(entries[1].html).toContain('Initial editor')
  })

  it('lists every release as a unique semantic version, newest first', () => {
    const entries = parseChangelog(readFileSync('CHANGELOG.md', 'utf8'))
    expect(entries[0].id).toBe(appVersion)
    for (const entry of entries) expect(entry.id).toMatch(/^\d+\.\d+\.\d+$/)
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length)
    expect(entries.at(-1)?.date).toBe('2026-10-24')
  })

  it('folds long releases after their first bullets, splitting a list', () => {
    const bullets = (from: number, count: number) =>
      Array.from({ length: count }, (_, i) => `- Change ${from + i}.`).join(
        '\n',
      )
    const entries = parseChangelog(
      `## [2.0.0] - 2026-11-02\n\n### Added\n\n${bullets(1, FOLD_KEEP + 2)}\n\n### Fixed\n\n${bullets(FOLD_KEEP + 3, FOLD_OVER)}\n\n## [1.0.0] - 2026-11-01\n\n${bullets(1, FOLD_OVER)}\n`,
    )
    const [long, short] = entries
    expect(long.more?.count).toBe(FOLD_OVER + FOLD_KEEP + 2)
    expect(long.html).toContain(`Change ${FOLD_KEEP}.`)
    expect(long.html).not.toContain(`Change ${FOLD_KEEP + 1}.`)
    expect(long.html).not.toContain('Fixed')
    expect(long.more?.html).toContain(`Change ${FOLD_KEEP + 1}.`)
    expect(long.more?.html).toContain('Fixed')
    expect(long.more?.html).not.toContain(`Change ${FOLD_KEEP}.<`)
    expect(short.more).toBeUndefined()
    expect(short.html).toContain(`Change ${FOLD_OVER}.`)
  })
})
