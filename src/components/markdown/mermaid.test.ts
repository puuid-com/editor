import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { diagramQuery } from './mermaid'

const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(async (_id: string, code: string) => ({ svg: code })),
}))
vi.mock('mermaid', () => ({ default: mermaid }))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('diagram render queue', () => {
  it('skips cancelled work without blocking the next diagram', async () => {
    vi.stubEnv('SSR', false)
    const client = new QueryClient()
    const first = Promise.withResolvers<{ svg: string }>()
    mermaid.render.mockReturnValueOnce(first.promise)
    try {
      const drawing = client.fetchQuery(diagramQuery('first', false))
      await vi.waitFor(() => expect(mermaid.render).toHaveBeenCalledTimes(1))
      const obsolete = diagramQuery('obsolete', false)
      // Cancellation rejects the caller even while its queued render waits.
      const skipped = client.fetchQuery(obsolete).catch(() => undefined)
      await client.cancelQueries({ queryKey: obsolete.queryKey })
      const latest = client.fetchQuery(diagramQuery('latest', true))
      first.resolve({ svg: '<svg>first</svg>' })
      expect(await drawing).toBe('<svg>first</svg>')
      await skipped
      expect(await latest).toBe('latest')
      expect(mermaid.render.mock.calls.map((call) => call[1])).toEqual([
        'first',
        'latest',
      ])
    } finally {
      first.resolve({ svg: '' })
      client.clear()
    }
  })

  it('continues drawing after a diagram fails', async () => {
    vi.stubEnv('SSR', false)
    const client = new QueryClient()
    mermaid.render.mockRejectedValueOnce(new Error('Invalid diagram'))
    try {
      await expect(
        client.fetchQuery(diagramQuery('broken', false)),
      ).rejects.toThrow('Invalid diagram')
      expect(await client.fetchQuery(diagramQuery('valid', false))).toBe(
        'valid',
      )
    } finally {
      client.clear()
    }
  })
})
