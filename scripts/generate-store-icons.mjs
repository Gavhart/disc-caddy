import { access, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const publicDir = path.join(root, 'public')
const logoPath = path.join(publicDir, 'logo.png')
const storeDir = path.join(root, 'store-assets')
const iosIconDir = path.join(
  root,
  'ios/App/App/Assets.xcassets/AppIcon.appiconset',
)
const BG = { r: 15, g: 31, b: 20, alpha: 1 }

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function makeSquareIcon(size: number, outPath: string, padding = 0.12) {
  const logoMeta = await sharp(logoPath).metadata()
  const inner = Math.round(size * (1 - padding * 2))
  const scale = Math.min(inner / (logoMeta.width ?? 1), inner / (logoMeta.height ?? 1))
  const width = Math.max(1, Math.round((logoMeta.width ?? 1) * scale))
  const height = Math.max(1, Math.round((logoMeta.height ?? 1) * scale))
  const left = Math.round((size - width) / 2)
  const top = Math.round((size - height) / 2)
  const logo = await sharp(logoPath).resize(width, height).png().toBuffer()

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logo, left, top }])
    .png()
    .toFile(outPath)

  console.log(`wrote ${path.relative(root, outPath)} (${size}x${size})`)
}

async function makeFeatureGraphic(outPath: string) {
  const width = 1024
  const height = 500
  const logoMeta = await sharp(logoPath).metadata()
  const targetHeight = 220
  const scale = targetHeight / (logoMeta.height ?? 1)
  const logoWidth = Math.max(1, Math.round((logoMeta.width ?? 1) * scale))
  const logoHeight = Math.max(1, Math.round((logoMeta.height ?? 1) * scale))
  const logo = await sharp(logoPath).resize(logoWidth, logoHeight).png().toBuffer()

  await sharp({
    create: { width, height, channels: 4, background: BG },
  })
    .composite([{ input: logo, left: Math.round((width - logoWidth) / 2), top: Math.round((height - logoHeight) / 2) }])
    .png()
    .toFile(outPath)

  console.log(`wrote ${path.relative(root, outPath)} (${width}x${height})`)
}

if (!(await fileExists(logoPath))) {
  console.error(
    'Missing public/logo.png — add your logo file, then re-run: npm run store:icons',
  )
  process.exit(1)
}

await mkdir(storeDir, { recursive: true })
await mkdir(iosIconDir, { recursive: true })

await makeSquareIcon(1024, path.join(iosIconDir, 'AppIcon-512@2x.png'))
await makeSquareIcon(512, path.join(storeDir, 'play-store-icon-512.png'))
await makeSquareIcon(512, path.join(storeDir, 'app-store-marketing-512.png'))
await makeFeatureGraphic(path.join(storeDir, 'play-feature-graphic-1024x500.png'))

console.log('')
console.log('Next steps:')
console.log('  iOS — AppIcon is updated; open Xcode and verify Assets → AppIcon')
console.log('  Android — Android Studio → Image Asset → import play-store-icon-512.png')
console.log('  Play Console — upload play-feature-graphic-1024x500.png as feature graphic')
