// Player profile and bag state now live in Supabase (see lib/profile.ts and
// lib/bags.ts). Only the hole input stays local — it's transient and not worth
// persisting across devices.

import { Hole } from '../types'

const KEY_HOLE = 'disc-caddy:hole'

function loadJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function saveJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

export const localState = {
  loadHole: () => loadJSON<Hole>(KEY_HOLE),
  saveHole: (h: Hole) => saveJSON(KEY_HOLE, h),
}
