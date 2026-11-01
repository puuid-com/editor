import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { previews } from './previews'
import { parseChangelog } from '#/lib/changelog'

describe('changelog previews', () => {
  it('belong to releases in CHANGELOG.md', () => {
    const versions = new Set(
      parseChangelog(readFileSync('CHANGELOG.md', 'utf8')).map((e) => e.id),
    )
    for (const version of Object.keys(previews))
      expect(versions).toContain(version)
  })
})
