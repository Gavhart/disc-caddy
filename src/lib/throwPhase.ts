/** Drive / approach / putt — aligned with recommender distance bands. */
export type ThrowPhase = 'drive' | 'approach' | 'putt'

/** Upshot and putt range — matches effectiveHoleForShots straight-at-basket cutoff. */
export const PUTT_RANGE_FT = 120

/** Full swing off the tee or fairway. */
export const DRIVE_RANGE_FT = 220

export function classifyThrowPhase(
  remainingBeforeFt: number,
  isTeeShot: boolean,
): ThrowPhase {
  if (remainingBeforeFt <= PUTT_RANGE_FT) return 'putt'
  if (isTeeShot || remainingBeforeFt > DRIVE_RANGE_FT) return 'drive'
  return 'approach'
}

export function nextThrowPhase(remainingFt: number): ThrowPhase {
  if (remainingFt <= PUTT_RANGE_FT) return 'putt'
  if (remainingFt > DRIVE_RANGE_FT) return 'drive'
  return 'approach'
}

export function throwPhaseLabel(phase: ThrowPhase): string {
  if (phase === 'drive') return 'Drive'
  if (phase === 'approach') return 'Approach'
  return 'Putt'
}

export function throwPhasePickLabel(phase: ThrowPhase, remainingFt: number): string {
  const dist = `${remainingFt.toLocaleString()} ft`
  if (phase === 'putt') return `Putt picks · ${dist} out`
  if (phase === 'approach') return `Upshot picks · ${dist} out`
  return `Drive picks · ${dist} out`
}

export const THROW_PHASE_COLORS: Record<ThrowPhase, string> = {
  drive: '#3b82f6',
  approach: '#f59e0b',
  putt: '#22c55e',
}
