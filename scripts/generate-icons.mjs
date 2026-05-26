import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '..', 'public')
const logoPath = path.join(publicDir, 'logo.png')
const iconsDir = path.join(publicDir, 'icons')
const BG = { r: 15, g: 31, b: 20, alpha: 1 }

async function makeIcon(size, outName, padding = 0.12) {
  const logoMeta = await sharp(logoPath).metadata()
  const inner = Math.round(size * (1 - padding * 2))
  const scale = Math.min(inner / logoMeta.width, inner / logoMeta.height)
  const width = Math.max(1, Math.round(logoMeta.width * scale))
  const height = Math.max(1, Math.round(logoMeta.height * scale))
  const left = Math.round((size - width) / 2)
  const top = Math.round((size - height) / 2)

  const logo = await sharp(logoPath).resize(width, height).png().toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: logo, left, top }])
    .png()
    .toFile(path.join(publicDir, outName))

  console.log(`wrote public/${outName} (${size}x${size})`)
}

await mkdir(iconsDir, { recursive: true })
await makeIcon(180, 'apple-touch-icon.png')
await makeIcon(192, 'icons/icon-192.png')
await makeIcon(512, 'icons/icon-512.png')
await makeIcon(32, 'favicon.png', 0.08)
