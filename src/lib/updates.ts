import { APP_VERSION } from '../data/updates'

const KEY = 'disc-caddy:last-seen-version'

export function getLastSeenVersion(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** True when the bundled app has release notes the user hasn't dismissed. */
export function hasUnreadUpdates(): boolean {
  const last = getLastSeenVersion()
  if (!last) return true
  return compareVersions(APP_VERSION, last) > 0
}

export function markUpdatesSeen(version: string = APP_VERSION) {
  try {
    localStorage.setItem(KEY, version)
  } catch {
    // ignore
  }
}

/** Whether a specific release is newer than what the user last dismissed. */
export function isReleaseUnread(releaseVersion: string): boolean {
  if (!hasUnreadUpdates()) return false
  const last = getLastSeenVersion()
  if (!last) return true
  return compareVersions(releaseVersion, last) > 0
}

/** Simple semver-ish compare: returns 1 if a > b, -1 if a < b, 0 if equal. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da > db) return 1
    if (da < db) return -1
  }
  return 0
}
