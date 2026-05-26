#!/usr/bin/env node
/**
 * Generate a printable invite QR PNG for flyers / course boards.
 *
 * Usage:
 *   node scripts/generate-invite-qr.mjs
 *   node scripts/generate-invite-qr.mjs https://your-app.vercel.app
 *   node scripts/generate-invite-qr.mjs https://your-app.vercel.app public/invite-qr.png
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

async function loadEnvAppUrl() {
  try {
    const raw = await readFile(path.join(root, '.env.local'), 'utf8')
    const match = raw.match(/^VITE_APP_URL=(.+)$/m)
    if (match) return match[1].trim().replace(/^["']|["']$/g, '')
  } catch {
    // ignore
  }
  return null
}

const baseUrl = (
  process.argv[2] ||
  (await loadEnvAppUrl()) ||
  'https://thedisccaddy.com'
).replace(/\/$/, '')

const outPath = path.resolve(
  root,
  process.argv[3] || 'public/invite-qr.png',
)

const inviteUrl = `${baseUrl}/invite`

await QRCode.toFile(outPath, inviteUrl, {
  width: 512,
  margin: 2,
  color: { dark: '#0f1f14', light: '#ffffff' },
})

console.log(`Invite URL: ${inviteUrl}`)
console.log(`QR saved:   ${outPath}`)
console.log('')
console.log('Print public/invite-qr.png or share the invite URL on social / group chats.')
