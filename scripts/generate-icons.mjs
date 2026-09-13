#!/usr/bin/env node
// Renders design/icon-source.svg to every PNG the manifest names (S0.4 AC2). Run it after
// changing the source or the --pwa-* tokens; the PNGs are committed, so the build never
// needs sharp. Sizes and filenames must stay in step with src/pwa/manifest.ts — the AC2
// test reads each file's IHDR chunk and fails if they drift.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()

/** The two hex tokens S0.2 declares for exactly this purpose; never repeated here. */
function pwaColours() {
  const css = readFileSync(join(ROOT, 'src', 'index.css'), 'utf8')
  const read = (name) => {
    const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))
    if (!m) throw new Error(`--${name} is missing from src/index.css`)
    return m[1]
  }
  return { theme: read('pwa-theme-color'), background: read('pwa-background-color') }
}

const OUTPUTS = [
  { file: 'public/icons/icon-192.png', size: 192 },
  { file: 'public/icons/icon-512.png', size: 512 },
  // Maskable icons are cropped to a circle or squircle by the launcher, so the artwork sits
  // inside the 80% safe zone and the background colour fills the rest (W3C maskable spec).
  { file: 'public/icons/icon-512-maskable.png', size: 512, maskable: true },
  { file: 'public/apple-touch-icon.png', size: 180 },
]

const { theme, background } = pwaColours()
const svg = readFileSync(join(ROOT, 'design', 'icon-source.svg'), 'utf8')
  .replaceAll('{{theme}}', theme)
  .replaceAll('{{background}}', background)

for (const { file, size, maskable = false } of OUTPUTS) {
  const out = join(ROOT, file)
  mkdirSync(dirname(out), { recursive: true })
  const artwork = maskable ? Math.round(size * 0.8) : size
  const pad = Math.round((size - artwork) / 2)
  const png = await sharp(Buffer.from(svg), { density: 72 })
    .resize(artwork, artwork)
    .flatten({ background })
    .extend({
      top: pad,
      bottom: size - artwork - pad,
      left: pad,
      right: size - artwork - pad,
      background,
    })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer()
  writeFileSync(out, png)
  console.log(`${file}  ${size}x${size}  ${png.length} bytes`)
}
