import { BagDisc, ThrowStyle } from '../types'

export interface PracticeThrow {
  id: string
  bagDiscId: string
  discName: string
  distanceFt: number
  throwStyle: ThrowStyle
  measuredAt: string
}

export interface DiscCoverage {
  bagDiscId: string
  discName: string
  measuredMaxFt: number | null
  estimatedMaxFt: number | null
  effectiveMaxFt: number
  throwCount: number
  source: 'measured' | 'estimated' | 'both'
}

export interface BagGap {
  fromFt: number
  toFt: number
  sizeFt: number
  label: string
}

export const DEFAULT_GAP_THRESHOLD_FT = 40

export function createPracticeThrow(input: {
  bagDiscId: string
  discName: string
  distanceFt: number
  throwStyle: ThrowStyle
}): PracticeThrow {
  return {
    id: crypto.randomUUID(),
    ...input,
    measuredAt: new Date().toISOString(),
  }
}

/** Max measured distance per bag disc from a practice session. */
export function measuredMaxByDisc(throws: PracticeThrow[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of throws) {
    const prev = map.get(t.bagDiscId)
    if (prev == null || t.distanceFt > prev) map.set(t.bagDiscId, t.distanceFt)
  }
  return map
}

export function buildDiscCoverage(
  bag: BagDisc[],
  throws: PracticeThrow[],
  estimatedByDiscId: Map<string, number>,
): DiscCoverage[] {
  const measured = measuredMaxByDisc(throws)
  const throwCounts = new Map<string, number>()
  for (const t of throws) {
    throwCounts.set(t.bagDiscId, (throwCounts.get(t.bagDiscId) ?? 0) + 1)
  }

  return bag.map(d => {
    const measuredMaxFt = measured.get(d.id) ?? null
    const estimatedMaxFt = estimatedByDiscId.get(d.id) ?? null
    const hasMeasured = measuredMaxFt != null
    const hasEstimate = estimatedMaxFt != null

    let effectiveMaxFt = 0
    let source: DiscCoverage['source'] = 'estimated'

    if (hasMeasured && hasEstimate) {
      effectiveMaxFt = Math.max(measuredMaxFt!, estimatedMaxFt!)
      source = measuredMaxFt! >= estimatedMaxFt! ? 'measured' : 'both'
    } else if (hasMeasured) {
      effectiveMaxFt = measuredMaxFt!
      source = 'measured'
    } else if (hasEstimate) {
      effectiveMaxFt = estimatedMaxFt!
      source = 'estimated'
    }

    return {
      bagDiscId: d.id,
      discName: d.discName,
      measuredMaxFt,
      estimatedMaxFt,
      effectiveMaxFt,
      throwCount: throwCounts.get(d.id) ?? 0,
      source,
    }
  })
}

export function findBagGaps(
  coverage: DiscCoverage[],
  opts?: { gapThresholdFt?: number; maxRangeFt?: number },
): BagGap[] {
  const gapThresholdFt = opts?.gapThresholdFt ?? DEFAULT_GAP_THRESHOLD_FT
  const maxRangeFt = opts?.maxRangeFt ?? 420

  const active = coverage
    .filter(c => c.effectiveMaxFt > 0)
    .sort((a, b) => a.effectiveMaxFt - b.effectiveMaxFt)

  if (active.length === 0) return []

  const gaps: BagGap[] = []

  for (let i = 0; i < active.length - 1; i++) {
    const lower = active[i]!
    const upper = active[i + 1]!
    const delta = upper.effectiveMaxFt - lower.effectiveMaxFt
    if (delta >= gapThresholdFt) {
      gaps.push({
        fromFt: lower.effectiveMaxFt,
        toFt: upper.effectiveMaxFt,
        sizeFt: delta,
        label: `${delta} ft between ${lower.discName} and ${upper.discName}`,
      })
    }
  }

  const last = active[active.length - 1]!
  const tailGap = maxRangeFt - last.effectiveMaxFt
  if (tailGap >= gapThresholdFt) {
    gaps.push({
      fromFt: last.effectiveMaxFt,
      toFt: maxRangeFt,
      sizeFt: tailGap,
      label: `Nothing past ~${last.effectiveMaxFt} ft`,
    })
  }

  return gaps
}

export function chartMaxRangeFt(
  coverage: DiscCoverage[],
  playerMaxDistance: number,
): number {
  const peaks = coverage.map(c => c.effectiveMaxFt).filter(d => d > 0)
  const sessionMax = peaks.length ? Math.max(...peaks) : 0
  return Math.max(200, playerMaxDistance, sessionMax + 40, 320)
}
