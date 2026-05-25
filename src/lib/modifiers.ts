import {
  Plastic,
  WEIGHT_GRAMS_DEFAULT,
  WEIGHT_GRAMS_MAX,
  WEIGHT_GRAMS_MIN,
  Weight,
  Wear,
} from '../types'

interface FlightMod {
  turn: number
  fade: number
}

/**
 * Plastic blend affects effective stability.
 * Base/baseline plastics (DX/Pro D/Electron) tend to be more understable.
 * Premium plastics (Star/Z/Neutron) hold their rated flight numbers.
 * Glow / specialty plastics are usually a touch more overstable.
 */
export const PLASTIC_MODS: Record<Plastic, FlightMod> = {
  Premium: { turn:  0.0, fade:  0.0 },
  Base:    { turn: -0.5, fade: -0.3 },
  Glow:    { turn:  0.2, fade:  0.2 },
}

const LEGACY_WEIGHT_GRAMS: Record<Weight, number> = {
  Max: 175,
  Standard: 170,
  Light: 160,
}

/** Parse stored bag_discs.weight (grams or legacy bucket label). */
export function parseWeightGrams(raw: string): number {
  const trimmed = raw.trim()
  const n = Number(trimmed)
  if (Number.isFinite(n) && n >= 100 && n <= 250) {
    return clampWeightGrams(Math.round(n))
  }
  if (trimmed in LEGACY_WEIGHT_GRAMS) {
    return LEGACY_WEIGHT_GRAMS[trimmed as Weight]
  }
  return WEIGHT_GRAMS_DEFAULT
}

export function clampWeightGrams(grams: number): number {
  return Math.min(WEIGHT_GRAMS_MAX, Math.max(WEIGHT_GRAMS_MIN, Math.round(grams)))
}

/**
 * Weight modifier from grams. Heavier discs fight wind better and are more
 * overstable. Thresholds match the old Max / Standard / Light buckets.
 */
export function weightModsForGrams(grams: number): FlightMod {
  if (grams < 165) return { turn: -0.5, fade: -0.3 }
  if (grams >= 173) return { turn: 0.3, fade: 0.3 }
  return { turn: 0.0, fade: 0.0 }
}

/**
 * Wear modifier. The more a disc is broken in, the more understable it gets.
 * Beat In can completely transform an overstable disc into a turnover machine.
 */
export const WEAR_MODS: Record<Wear, FlightMod> = {
  New:         { turn:  0.0, fade:  0.0 },
  'Broken In': { turn: -0.5, fade: -0.3 },
  'Beat In':   { turn: -1.5, fade: -0.8 },
}
