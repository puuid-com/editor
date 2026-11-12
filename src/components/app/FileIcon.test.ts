import {
  IconBraces,
  IconBrandNpm,
  IconDatabase,
  IconFileCode,
  IconInfoCircle,
  IconPhoto,
  IconSchema,
} from '@tabler/icons-react'
import { describe, expect, it } from 'vitest'

import { fileLook } from './FileIcon'

describe('fileLook', () => {
  it('gives each extension its own icon and colour', () => {
    expect(fileLook('order.xml')).toEqual({ icon: IconFileCode, tone: 'amber' })
    expect(fileLook('order.XSD').icon).toBe(IconSchema)
    expect(fileLook('rates.json').icon).toBe(IconBraces)
    expect(fileLook('report.sql').icon).toBe(IconDatabase)
    expect(fileLook('logo.png').icon).toBe(IconPhoto)
  })

  it('knows special file names before their extension', () => {
    expect(fileLook('package.json').icon).toBe(IconBrandNpm)
    expect(fileLook('README.md').icon).toBe(IconInfoCircle)
  })

  it('falls back to the language a name reads as', () => {
    expect(fileLook('untitled').icon).toBe(IconFileCode)
  })
})
