import { describe, expect, it } from 'vitest'

import {
  imageFileName,
  imageMarkdown,
  pastedImages,
  relativePath,
} from './pasted-images'

const png = (name = 'image.png') => new File(['x'], name, { type: 'image/png' })

describe('pasted images', () => {
  it('takes images, but not a picture that comes with copied text', () => {
    const image = png()
    expect(pastedImages([image], '')).toEqual([image])
    expect(pastedImages([image], 'shot.png')).toEqual([image])
    expect(pastedImages([image], 'A1\tB1\nA2\tB2')).toEqual([])
    expect(
      pastedImages([new File(['x'], 'a.txt', { type: 'text/plain' })], ''),
    ).toEqual([])
  })

  it('names screenshots by time and keeps real names', () => {
    const date = new Date(2026, 10, 7, 9, 5, 3)
    expect(imageFileName(png(), date)).toBe('image-20261107-090503.png')
    expect(imageFileName({ name: '', type: 'image/jpeg' }, date)).toBe(
      'image-20261107-090503.jpg',
    )
    expect(imageFileName(png('diagram.png'), date)).toBe('diagram.png')
  })

  it('links the image relative to the note', () => {
    expect(relativePath('note.md', 'attachements/img/a.png')).toBe(
      'attachements/img/a.png',
    )
    expect(relativePath('docs/deep/note.md', 'attachements/img/a.png')).toBe(
      '../../attachements/img/a.png',
    )
    expect(relativePath('attachements/note.md', 'attachements/img/a.png')).toBe(
      'img/a.png',
    )
    expect(imageMarkdown('My notes/n.md', 'attachements/img/a (1).png')).toBe(
      '![](../attachements/img/a%20%281%29.png)',
    )
  })
})
