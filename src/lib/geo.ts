import type { TeeBearing } from '../types'

const EARTH_RADIUS_MILES = 3959
const FEET_PER_MILE = 5280

/** Great-circle distance in miles between two WGS84 points. */
export function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Great-circle distance in feet (rounded to nearest foot). */
export function haversineFeet(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  return Math.round(haversineMiles(lat1, lon1, lat2, lon2) * FEET_PER_MILE)
}

/** Initial bearing from point 1 → point 2, degrees clockwise from north. */
export function initialBearingDegrees(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const toDeg = (rad: number) => ((rad * 180) / Math.PI + 360) % 360
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δλ = toRad(lon2 - lon1)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return toDeg(Math.atan2(y, x))
}

const TEE_BEARING_ORDER: TeeBearing[] = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
]

/** Snap a compass bearing to the nearest tee-facing octant. */
export function bearingToTeeBearing(degrees: number): TeeBearing {
  const idx = Math.round(degrees / 45) % 8
  return TEE_BEARING_ORDER[idx]
}

export function clampHoleDistanceFeet(feet: number): number {
  return Math.min(1500, Math.max(50, Math.round(feet)))
}

/** Field throws and upshots — wider lower bound than full holes. */
export function clampThrowDistanceFeet(feet: number): number {
  return Math.min(650, Math.max(5, Math.round(feet)))
}
