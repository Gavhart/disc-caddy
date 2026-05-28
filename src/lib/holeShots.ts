import { ThrowStyle } from '../types'
import { clampHoleDistanceFeet } from './geo'

export interface HoleShot {
  id: string
  distanceFt: number
  discName?: string
  throwStyle?: ThrowStyle
}

export function remainingHoleDistance(holeDistance: number, shots: HoleShot[]): number {
  const traveled = shots.reduce((sum, s) => sum + s.distanceFt, 0)
  return Math.max(0, Math.round(holeDistance - traveled))
}

/** Hole layout passed to the recommender after one or more throws. */
export function effectiveHoleForShots<T extends { distance: number; direction: T['direction'] }>(
  base: T,
  shots: HoleShot[],
): T {
  if (shots.length === 0) return base

  const remaining = remainingHoleDistance(base.distance, shots)
  if (remaining <= 0) return { ...base, distance: 50 }

  const nextDistance = clampHoleDistanceFeet(remaining)

  return {
    ...base,
    distance: nextDistance,
    // Upshots and putts usually play straight at the basket.
    direction: nextDistance <= 220 ? ('straight' as T['direction']) : base.direction,
  }
}

export function createHoleShot(input: {
  distanceFt: number
  discName?: string
  throwStyle?: ThrowStyle
}): HoleShot {
  return {
    id: crypto.randomUUID(),
    distanceFt: Math.max(1, Math.round(input.distanceFt)),
    discName: input.discName,
    throwStyle: input.throwStyle,
  }
}

/** User entered remaining distance after the throw — convert to throw length. */
export function shotDistanceFromRemaining(
  holeDistance: number,
  shots: HoleShot[],
  remainingFt: number,
): number | null {
  const before = remainingHoleDistance(holeDistance, shots)
  const nextRemaining = Math.max(0, Math.round(remainingFt))
  if (nextRemaining >= before) return null
  return before - nextRemaining
}
