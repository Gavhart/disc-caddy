import { PublicRoundRecap } from '../types'
import { formatScoreToPar } from './rounds'

export function generateRecapImage(recap: PublicRoundRecap): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1080
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Canvas not supported'))
      return
    }

    const place = [recap.courseName, recap.courseLocality].filter(Boolean).join(', ')
    const top = recap.players[0]
    const headline = top
      ? `Shot ${top.total_strokes} (${formatScoreToPar(top.score_to_par)})`
      : 'Round recap'
    const sub = place
      ? `at ${place}${recap.players.length > 1 ? ` · ${recap.players.length} players` : ''}`
      : recap.players.length > 1
        ? `${recap.players.length} players`
        : ''

    ctx.fillStyle = '#0f1f14'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = '#7ddf64'
    ctx.font = 'bold 48px system-ui, sans-serif'
    ctx.fillText('Disc Caddy', 64, 100)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 72px system-ui, sans-serif'
    wrapText(ctx, headline, 64, 280, 952, 80)

    if (sub) {
      ctx.fillStyle = '#b8c9bc'
      ctx.font = '36px system-ui, sans-serif'
      wrapText(ctx, sub, 64, 420, 952, 44)
    }

    if (recap.playedAt) {
      ctx.fillStyle = '#889a8d'
      ctx.font = '28px system-ui, sans-serif'
      ctx.fillText(
        new Date(recap.playedAt).toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        64,
        520,
      )
    }

    let y = 620
    ctx.font = '32px system-ui, sans-serif'
    for (const p of recap.players.slice(0, 6)) {
      ctx.fillStyle = '#ffffff'
      ctx.fillText(p.display_name, 64, y)
      ctx.fillStyle = '#7ddf64'
      ctx.fillText(
        `${p.total_strokes} (${formatScoreToPar(p.score_to_par)})`,
        640,
        y,
      )
      y += 52
    }

    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Could not create image'))),
      'image/png',
    )
  })
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(' ')
  let line = ''
  let cy = y
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy)
      line = word
      cy += lineHeight
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, cy)
}

export async function downloadRecapImage(
  recap: PublicRoundRecap,
  filename = 'disc-caddy-round.png',
): Promise<void> {
  const blob = await generateRecapImage(recap)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
