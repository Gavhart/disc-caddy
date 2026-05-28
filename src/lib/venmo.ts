export interface VenmoPayTemplate {
  id: string
  label: string
  note: string
}

/** Quick-pay presets shown on league money panels. */
export const VENMO_PAY_TEMPLATES: VenmoPayTemplate[] = [
  { id: 'ace-pot', label: 'Ace pot', note: 'Ace pot' },
  { id: 'skins', label: 'Skins', note: 'Skins' },
  { id: 'dues', label: 'Club dues', note: 'Club dues' },
  { id: 'mini', label: 'Mini buy-in', note: 'Mini buy-in' },
  { id: 'payout', label: 'League payout', note: 'League payout' },
]

/** Strip @ and whitespace; return null when empty. */
export function normalizeVenmoUsername(raw: string): string | null {
  const cleaned = raw.trim().replace(/^@/, '')
  return cleaned.length > 0 ? cleaned : null
}

export function isValidVenmoUsername(raw: string): boolean {
  const username = normalizeVenmoUsername(raw)
  if (!username) return true
  return /^[A-Za-z0-9_-]{1,30}$/.test(username)
}

export function formatVenmoHandle(raw: string | null | undefined): string | null {
  const username = normalizeVenmoUsername(raw ?? '')
  return username ? `@${username}` : null
}

export function buildVenmoPayUrl(opts: {
  username: string
  amountDollars?: number
  note?: string
}): string {
  const username = normalizeVenmoUsername(opts.username)
  if (!username) throw new Error('Venmo username required')

  const params = new URLSearchParams({
    txn: 'pay',
    recipients: username,
  })

  if (opts.amountDollars != null && opts.amountDollars > 0) {
    params.set('amount', opts.amountDollars.toFixed(2))
  }
  if (opts.note?.trim()) {
    params.set('note', opts.note.trim())
  }

  return `https://venmo.com/?${params.toString()}`
}

export function buildVenmoNote(leagueName: string, templateNote: string): string {
  const league = leagueName.trim() || 'League'
  return `${league} — ${templateNote}`
}

export function openVenmoPay(opts: Parameters<typeof buildVenmoPayUrl>[0]): void {
  const url = buildVenmoPayUrl(opts)
  window.open(url, '_blank', 'noopener,noreferrer')
}
