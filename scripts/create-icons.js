/**
 * Generates themed app icons from logo_mask.png (dark ink on transparent).
 * Outputs:
 *   assets/icon_light.png  – orange/vermilion, for light mode runtime icon
 *   assets/icon_dark.png   – blue, for dark mode runtime icon
 *   assets/icon_light.ico  – multi-size ICO used by installer/shortcuts (orange)
 *
 * Run: node scripts/create-icons.js
 */

const Jimp = require('jimp')
const fs   = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC  = path.join(ROOT, 'assets/logo_mask.png')

// Must match the design tokens in src/index.css
const LIGHT = { r: 0xd6, g: 0x38, b: 0x1c } // --accent light (vermilion)
const DARK  = { r: 0x8f, g: 0xa3, b: 0xef } // --accent dark  (blue)

const SIZES = [16, 32, 48, 256] // ICO will contain all four

async function tintClone(img, accent) {
  const clone = img.clone()
  clone.scan(0, 0, clone.bitmap.width, clone.bitmap.height, (x, y, idx) => {
    if (clone.bitmap.data[idx + 3] === 0) return // keep transparent pixels as-is
    clone.bitmap.data[idx + 0] = accent.r
    clone.bitmap.data[idx + 1] = accent.g
    clone.bitmap.data[idx + 2] = accent.b
    // preserve alpha for smooth anti-aliased edges
  })
  return clone
}

async function resizedPng(img, size) {
  const r = img.clone().resize(size, size, Jimp.RESIZE_LANCZOS3)
  return r.getBufferAsync(Jimp.MIME_PNG)
}

// ICO file = header + N directory entries + N PNG blobs
function buildIco(pngBufs) {
  const n = pngBufs.length
  const HEADER = 6
  const ENTRY  = 16
  const dataStart = HEADER + n * ENTRY

  const offsets = []
  let off = dataStart
  for (const b of pngBufs) { offsets.push(off); off += b.length }

  const hdr = Buffer.alloc(HEADER)
  hdr.writeUInt16LE(0, 0) // reserved
  hdr.writeUInt16LE(1, 2) // type = ICO
  hdr.writeUInt16LE(n, 4) // image count

  const entries = pngBufs.map((buf, i) => {
    const e = Buffer.alloc(ENTRY)
    const sz = SIZES[i]
    e[0] = sz >= 256 ? 0 : sz // 0 encodes 256 in the ICO spec
    e[1] = sz >= 256 ? 0 : sz
    e[2] = 0; e[3] = 0         // colorCount, reserved
    e.writeUInt16LE(1,  4)     // planes
    e.writeUInt16LE(32, 6)     // bit depth (32-bit RGBA)
    e.writeUInt32LE(buf.length, 8)
    e.writeUInt32LE(offsets[i], 12)
    return e
  })

  return Buffer.concat([hdr, ...entries, ...pngBufs])
}

async function main() {
  console.log('Reading', SRC)
  const src = await Jimp.read(SRC)

  const lightImg = await tintClone(src, LIGHT)
  const darkImg  = await tintClone(src, DARK)

  // Full-size PNGs (256px) for the runtime icons
  const lightPng256 = await resizedPng(lightImg, 256)
  const darkPng256  = await resizedPng(darkImg,  256)

  fs.writeFileSync(path.join(ROOT, 'assets/icon_light.png'), lightPng256)
  console.log('✓ assets/icon_light.png (256×256 orange)')

  fs.writeFileSync(path.join(ROOT, 'assets/icon_dark.png'), darkPng256)
  console.log('✓ assets/icon_dark.png  (256×256 blue)')

  // Multi-size ICO for installer/shortcuts — orange (light) as default
  const icoBufs = await Promise.all(SIZES.map(sz => resizedPng(lightImg, sz)))
  const ico = buildIco(icoBufs)
  fs.writeFileSync(path.join(ROOT, 'assets/icon_light.ico'), ico)
  console.log(`✓ assets/icon_light.ico (${SIZES.join(', ')}px, orange)`)
}

main().catch(e => { console.error(e); process.exit(1) })
