/** Public site URL for share links and QR codes. Set in Vercel as VITE_APP_URL. */
const CONFIGURED_URL = import.meta.env.VITE_APP_URL as string | undefined

export function getAppBaseUrl(): string {
  if (CONFIGURED_URL?.trim()) {
    return CONFIGURED_URL.replace(/\/$/, '')
  }
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'https://disc-caddy.app'
}

/** Landing page with QR — best link to print or share. */
export function invitePageUrl(ref?: string | null): string {
  const base = `${getAppBaseUrl()}/invite`
  if (!ref?.trim()) return base
  return `${base}?ref=${encodeURIComponent(ref.trim())}`
}

/** Direct signup link (used after scanning if you prefer). */
export function signupInviteUrl(ref?: string | null): string {
  const base = `${getAppBaseUrl()}/signup`
  if (!ref?.trim()) return base
  return `${base}?ref=${encodeURIComponent(ref.trim())}`
}

const REF_KEY = 'disc-caddy:invite-ref'

export function persistInviteRef(ref: string): void {
  try {
    localStorage.setItem(REF_KEY, ref.trim())
  } catch {
    // ignore
  }
}

export function loadInviteRef(): string | null {
  try {
    return localStorage.getItem(REF_KEY)
  } catch {
    return null
  }
}

export function captureInviteRefFromSearch(search: string): void {
  const ref = new URLSearchParams(search).get('ref')
  if (ref) persistInviteRef(ref)
}
