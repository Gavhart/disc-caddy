import { access, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const inputDir = path.join(root, 'store-assets/screenshots/raw')
const outputDir = path.join(root, 'store-assets/screenshots/ios')

/** Disc Caddy brand background — matches splash / status bar */
const BG = { r: 15, g: 31, b: 20, alpha: 1 }

/** Sizes App Store Connect accepts for 6.5" / 6.7" iPhone slots */
const IOS_SIZES = [
  { name: '1242x2688-portrait', width: 1242, height: 2688 },
  { name: '2688x1242-landscape', width: 2688, height: 1242 },
  { name: '1284x2778-portrait', width: 1284, height: 2778 },
  { name: '2778x1284-landscape', width: 2778, height: 1284 },
]

const IMAGE_EXT = /\.(png|jpe?g|webp)$/i

async function fileExists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

/** Fit image inside target, letterbox with brand color (no cropping). */
async function exportSize(inputPath, baseName, size) {
  const image = sharp(inputPath)
  const meta = await image.metadata()
  if (!meta.width || !meta.height) {
    throw new Error(`Could not read dimensions: ${inputPath}`)
  }

  const srcRatio = meta.width / meta.height
  const dstRatio = size.width / size.height
  const ratioDelta = Math.abs(srcRatio - dstRatio) / dstRatio
  const outPath = path.join(outputDir, `${baseName}-${size.name}.png`)

  // Simulator screenshots match iPhone aspect ratio — scale up, don't letterbox.
  if (ratioDelta < 0.02) {
    await image
      .resize(size.width, size.height, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .png()
      .toFile(outPath)
    console.log(`  → ${path.relative(root, outPath)}`)
    return
  }

  const scale = Math.min(size.width / meta.width, size.height / meta.height)
  const resizedW = Math.max(1, Math.round(meta.width * scale))
  const resizedH = Math.max(1, Math.round(meta.height * scale))
  const left = Math.round((size.width - resizedW) / 2)
  const top = Math.round((size.height - resizedH) / 2)

  const resized = await image.resize(resizedW, resizedH).png().toBuffer()

  await sharp({
    create: { width: size.width, height: size.height, channels: 4, background: BG },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(outPath)

  console.log(`  → ${path.relative(root, outPath)}`)
}

async function main() {
  if (!(await fileExists(inputDir))) {
    await mkdir(inputDir, { recursive: true })
    console.log('')
    console.log('Created folder: store-assets/screenshots/raw/')
    console.log('')
    console.log('Add your screenshot PNG/JPG files there, then run:')
    console.log('  npm run store:screenshots')
    console.log('')
    console.log('Output goes to store-assets/screenshots/ios/')
    return
  }

  const files = (await readdir(inputDir)).filter(f => IMAGE_EXT.test(f))
  if (files.length === 0) {
    console.log('')
    console.log('No images found in store-assets/screenshots/raw/')
    console.log('Drop PNG or JPG screenshots there, then re-run: npm run store:screenshots')
    console.log('')
    return
  }

  await mkdir(outputDir, { recursive: true })
  console.log(`Processing ${files.length} screenshot(s)…\n`)

  for (const file of files) {
    const inputPath = path.join(inputDir, file)
    const baseName = path.basename(file, path.extname(file))
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-|-$/g, '')

    console.log(file)
    for (const size of IOS_SIZES) {
      await exportSize(inputPath, baseName, size)
    }
    console.log('')
  }

  console.log('Done. Upload the *-1284x2778-portrait.png files to App Store Connect')
  console.log('(portrait 6.7" slot). Keep landscape versions if you add landscape support.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
