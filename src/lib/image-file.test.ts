import { describe, expect, it } from 'vitest'
import { contentBlob, imageMime, readFileContent } from './image-file'
import { languageOf } from './document'
import { isEditableName } from './disk-tree'

describe('image files', () => {
  it.each([
    'PNG',
    'jpg',
    'jpeg',
    'jfif',
    'gif',
    'webp',
    'avif',
    'bmp',
    'ico',
    'apng',
    'svg',
  ])('recognizes and opens %s images', (ext) => {
    expect(imageMime(`photo.${ext}`)).toMatch(/^image\//)
    expect(isEditableName(`photo.${ext}`)).toBe(true)
  })
  it('preserves binary bytes across import, storage, rename and export', async () => {
    const bytes = new Uint8Array([0, 255, 128, 13, 10, 42])
    const content = await readFileContent(new File([bytes], 'photo.PNG'))
    expect(content).toMatch(/^data:image\/png;base64,/)
    expect(languageOf('renamed.txt', content)).toBe('image')
    expect(new Uint8Array(await contentBlob(content).arrayBuffer())).toEqual(
      bytes,
    )
    expect(contentBlob(content).type).toBe('image/png')
  })
  it('preserves SVG and regular text exactly', async () => {
    for (const [name, text] of [
      ['drawing.svg', '<svg><!-- café --></svg>'],
      ['notes.txt', 'hello\r\nworld'],
    ]) {
      const content = await readFileContent(new File([text], name))
      expect(content).toBe(text)
      expect(await contentBlob(content).text()).toBe(text)
    }
  })
})
