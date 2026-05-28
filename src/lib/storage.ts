// Player profile and bag state now live in Supabase (see lib/profile.ts and
// lib/bags.ts). Only the hole input stays local — it's transient and not worth
// persisting across devices.

import { Hole, WindDirection } from '../types'

const KEY_HOLE = 'disc-caddy:hole'
const KEY_ROUND = 'disc-caddy:round'

/** Default layout values applied when a stored hole pre-dates a schema
 *  bump. Keeps the recommender from seeing `undefined` for fields it relies
 *  on. Mirrors `DEFAULT_HOLE` on HomePage but kept here so the storage layer
 *  has zero downstream import coupling. */
const HOLE_DEFAULTS = {
  terrain: 'flat' as const,
  treeCoverage: 'open' as const,
  treeLayout: 'none' as const,
  mando: 'none' as const,
  teeBearing: 'north' as const,
  windDirection: 'none' as const,
}

/** Migrate legacy capitalized wind values to the new snake_case compass set. */
const LEGACY_WIND_MAP: Record<string, WindDirection> = {
  None: 'none',
  Headwind: 'headwind',
  Tailwind: 'tailwind',
}

function migrateWind(raw: unknown): WindDirection {
  if (typeof raw !== 'string') return 'none'
  if (raw in LEGACY_WIND_MAP) return LEGACY_WIND_MAP[raw]
  return raw as WindDirection
}

/** Round-in-progress state: course, hole, optional active round + local throw cache. */
export interface RoundState {
  courseId: string | null
  holeNumber: number | null
  /** Supabase round id when a Pro live round is active. */
  roundId: string | null
  active: boolean
}

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
  loadHole: () => {
    const raw = loadJSON<Partial<Hole>>(KEY_HOLE)
    if (!raw) return null
    // Hydrate older snapshots that pre-date the layout-detail columns, and
    // migrate the wind direction enum from its legacy capitalized form.
    return {
      ...HOLE_DEFAULTS,
      ...raw,
      windDirection: migrateWind(raw.windDirection),
    } as Hole
  },
  saveHole: (h: Hole) => saveJSON(KEY_HOLE, h),
  loadRound: () => {
    const raw = loadJSON<Partial<RoundState>>(KEY_ROUND)
    if (!raw) return null
    return {
      courseId: raw.courseId ?? null,
      holeNumber: raw.holeNumber ?? null,
      roundId: raw.roundId ?? null,
      active: raw.active ?? false,
    } satisfies RoundState
  },
  saveRound: (r: RoundState) => saveJSON(KEY_ROUND, r),
  clearRound: () => {
    try {
      localStorage.removeItem(KEY_ROUND)
    } catch {
      // ignore
    }
  },
}
