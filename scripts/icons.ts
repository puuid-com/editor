// Renders the PNG app icons from public/favicon.svg: `bun run icons`.
// Run it again after replacing the favicon, then commit the PNGs.
//   icon-*.png           purpose "any": the favicon as drawn
//   icon-maskable-*.png  purpose "maskable": full-bleed theme colour with the
//                        favicon inside the safe zone, so any mask shape fits
//   apple-touch-icon.png iOS needs an opaque image and rounds it itself
import { readFileSync } from 'node:fs'
import sharp from 'sharp'

import { site } from '../src/site'

const svg = readFileSync('public/favicon.svg')
const { width = 32 } = await sharp(svg).metadata()

/** The favicon rasterized at `size`, with density set so it is drawn sharp, not scaled. */
const logo = (size: number) =>
  sharp(svg, { density: (72 * size) / width })
    .resize(size, size)
    .png()
    .toBuffer()

async function tile(size: number) {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: site.themeColor,
    },
  })
    .composite([{ input: await logo(Math.round(size * 0.6)) }])
    .png()
}

for (const size of [192, 512]) {
  await sharp(await logo(size)).toFile(`public/icon-${size}.png`)
  await (await tile(size)).toFile(`public/icon-maskable-${size}.png`)
}
await (await tile(180)).toFile('public/apple-touch-icon.png')

console.log('Wrote public/icon-*.png and public/apple-touch-icon.png')

// Social cards use a fixed light canvas so crawlers render a consistent mark.
const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#fafafa"/>
  <path d="M72 460h1056" stroke="#d4d4d4"/>
  <text x="72" y="345" font-family="sans-serif" font-size="96" font-weight="600" fill="#0a0a0a">${site.name}</text>
  <text x="76" y="407" font-family="monospace" font-size="29" fill="#525252">XML · JSON · SQL · Markdown · TXT · ZPL</text>
  <text x="76" y="520" font-family="monospace" font-size="24" fill="#525252">${new URL(site.url).hostname}</text>
</svg>`
await sharp(Buffer.from(card))
  .composite([{ input: await logo(96), left: 72, top: 100 }])
  .png()
  .toFile('public/og.png')
console.log('Wrote public/og.png')
