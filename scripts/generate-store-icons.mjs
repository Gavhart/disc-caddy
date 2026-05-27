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
const iosSplashDir = path.join(
  root,
  'ios/App/App/Assets.xcassets/Splash.imageset',
)
const BG = { r: 15, g: 31, b: 20, alpha: 1 }

async function fileExists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function logoOnBackground(width, height, outPath, padding = 0.12) {
  const logoMeta = await sharp(logoPath).metadata()
  const innerW = Math.round(width * (1 - padding * 2))
  const innerH = Math.round(height * (1 - padding * 2))
  const scale = Math.min(
    innerW / (logoMeta.width ?? 1),
    innerH / (logoMeta.height ?? 1),
  )
  const logoW = Math.max(1, Math.round((logoMeta.width ?? 1) * scale))
  const logoH = Math.max(1, Math.round((logoMeta.height ?? 1) * scale))
  const left = Math.round((width - logoW) / 2)
  const top = Math.round((height - logoH) / 2)
  const logo = await sharp(logoPath).resize(logoW, logoH).png().toBuffer()

  await sharp({
    create: { width, height, channels: 4, background: BG },
  })
    .composite([{ input: logo, left, top }])
    .png()
    .toFile(outPath)

  console.log(`wrote ${path.relative(root, outPath)} (${width}x${height})`)
}

async function makeSquareIcon(size, outPath, padding = 0.12) {
  await logoOnBackground(size, size, outPath, padding)
}

async function makeFeatureGraphic(outPath) {
  await logoOnBackground(1024, 500, outPath, 0.1)
}

async function makeIosSplash() {
  const size = 2732
  const out = path.join(iosSplashDir, 'splash-2732x2732.png')
  await logoOnBackground(size, size, out, 0.18)
  // Storyboard references 1x/2x/3x — same asset scaled by iOS is fine for Capacitor default setup.
  await logoOnBackground(size, size, path.join(iosSplashDir, 'splash-2732x2732-1.png'), 0.18)
  await logoOnBackground(size, size, path.join(iosSplashDir, 'splash-2732x2732-2.png'), 0.18)
}

if (!(await fileExists(logoPath))) {
  console.error(
    'Missing public/logo.png — add your logo file, then re-run: npm run store:icons',
  )
  process.exit(1)
}

await mkdir(storeDir, { recursive: true })
await mkdir(iosIconDir, { recursive: true })
await mkdir(iosSplashDir, { recursive: true })

await makeSquareIcon(1024, path.join(iosIconDir, 'AppIcon-512@2x.png'))
await makeIosSplash()
await makeSquareIcon(512, path.join(storeDir, 'play-store-icon-512.png'))
await makeSquareIcon(512, path.join(storeDir, 'app-store-marketing-512.png'))
await makeFeatureGraphic(path.join(storeDir, 'play-feature-graphic-1024x500.png'))

console.log('')
console.log('iOS native assets updated from public/logo.png')
console.log('')
console.log('Next:')
console.log('  1. npm run build:mobile   # copies logo into the in-app web bundle')
console.log('  2. Xcode → Product → Clean Build Folder, then Run')
console.log('  3. Delete the app from simulator/device if the home-screen icon looks cached')
