import { describe, expect, it } from 'vitest'

import { formatDay } from './dates'

describe('formatDay', () => {
  it('shows the calendar day whatever the time zone', () => {
    expect(formatDay('2026-11-02', 'en')).toBe('Nov 2, 2026')
    expect(formatDay('2026-01-01', 'fr')).toBe('1 janv. 2026')
  })
})
