import { ThrowStyle } from '../types'
import { clampHoleDistanceFeet } from './geo'
import { classifyThrowPhase, type ThrowPhase } from './throwPhase'

export interface HoleShot {
  id: string
  distanceFt: number
  bagDiscId?: string
  discName?: string
  throwStyle?: ThrowStyle
  throwPhase?: ThrowPhase
  remainingBeforeFt?: number
  landingLat?: number
  landingLon?: number
}

export type HoleProgressStatus = 'playing' | 'at_basket' | 'past_basket'

export interface HoleProgress {
  remaining: number
  traveled: number
  status: HoleProgressStatus
  /** Feet past the basket when status is past_basket. */
  overshootFt?: number
}

export function holeProgress(holeDistance: number, shots: HoleShot[]): HoleProgress {
  const traveled = shots.reduce((sum, s) => sum + s.distanceFt, 0)
  const rawRemaining = Math.round(holeDistance - traveled)

  if (rawRemaining > 0) {
    return { remaining: rawRemaining, traveled, status: 'playing' }
  }
  if (rawRemaining === 0) {
    return { remaining: 0, traveled, status: 'at_basket' }
  }
  return {
    remaining: 0,
    traveled,
    overshootFt: Math.abs(rawRemaining),
    status: 'past_basket',
  }
}

/** Remaining feet while still approaching the basket (0 once holed or overshot). */
export function remainingHoleDistance(holeDistance: number, shots: HoleShot[]): number {
  const progress = holeProgress(holeDistance, shots)
  return progress.status === 'playing' ? progress.remaining : 0
}

/** Hole layout passed to the recommender after one or more throws. */
export function effectiveHoleForShots<T extends { distance: number; direction: T['direction'] }>(
  base: T,
  shots: HoleShot[],
): T {
  if (shots.length === 0) return base

  const progress = holeProgress(base.distance, shots)

  if (progress.status === 'at_basket') {
    return { ...base, distance: 50, direction: 'straight' as T['direction'] }
  }

  if (progress.status === 'past_basket') {
    const comeback = clampHoleDistanceFeet(progress.overshootFt ?? 50)
    return { ...base, distance: comeback, direction: 'straight' as T['direction'] }
  }

  const nextDistance = clampHoleDistanceFeet(progress.remaining)

  return {
    ...base,
    distance: nextDistance,
    // Upshots and putts usually play straight at the basket.
    direction: nextDistance <= 120 ? ('straight' as T['direction']) : base.direction,
  }
}

export function createHoleShot(input: {
  distanceFt: number
  bagDiscId?: string
  discName?: string
  throwStyle?: ThrowStyle
  throwPhase?: ThrowPhase
  remainingBeforeFt?: number
  landingLat?: number
  landingLon?: number
}): HoleShot {
  return {
    id: crypto.randomUUID(),
    distanceFt: Math.max(1, Math.round(input.distanceFt)),
    bagDiscId: input.bagDiscId,
    discName: input.discName,
    throwStyle: input.throwStyle,
    throwPhase: input.throwPhase,
    remainingBeforeFt: input.remainingBeforeFt,
    landingLat: input.landingLat,
    landingLon: input.landingLon,
  }
}

/** Build a shot with auto-classified phase from current hole progress. */
export function buildHoleShot(
  holeDistance: number,
  existingShots: HoleShot[],
  input: {
    distanceFt: number
    bagDiscId?: string
    discName?: string
    throwStyle?: ThrowStyle
    landingLat?: number
    landingLon?: number
  },
): HoleShot {
  const before = holeProgress(holeDistance, existingShots)
  const remainingBefore =
    before.status === 'playing' ? before.remaining : Math.max(0, input.distanceFt)

  return createHoleShot({
    ...input,
    remainingBeforeFt: remainingBefore,
    throwPhase: classifyThrowPhase(remainingBefore, existingShots.length === 0),
  })
}

/** User entered remaining distance after the throw — convert to throw length. */
export function shotDistanceFromRemaining(
  holeDistance: number,
  shots: HoleShot[],
  remainingFt: number,
): number | null {
  const before = holeProgress(holeDistance, shots)
  if (before.status !== 'playing') return null

  const nextRemaining = Math.max(0, Math.round(remainingFt))
  if (nextRemaining >= before.remaining) return null
  return before.remaining - nextRemaining
}

/** Clamp an estimated carry so hole progress never skips ahead of the basket. */
export function clampThrowToRemaining(
  throwFt: number,
  holeDistance: number,
  shots: HoleShot[],
): number {
  const before = holeProgress(holeDistance, shots)
  if (before.status !== 'playing') return Math.max(1, Math.round(throwFt))
  return Math.max(1, Math.min(Math.round(throwFt), before.remaining))
}

export function summarizeThrowPhases(shots: HoleShot[]): Record<ThrowPhase, number> {
  return shots.reduce(
    (acc, s) => {
      const phase = s.throwPhase ?? 'approach'
      acc[phase] += 1
      return acc
    },
    { drive: 0, approach: 0, putt: 0 } as Record<ThrowPhase, number>,
  )
}
