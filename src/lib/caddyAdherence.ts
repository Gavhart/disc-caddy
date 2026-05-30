import type { CaddyAdherenceStats, RoundThrow } from '../types'
import type { ThrowPhase } from './throwPhase'

export function adherencePct(topPick: number, total: number): number | null {
  if (total <= 0) return null
  return Math.round((topPick / total) * 100)
}

export function computeAdherenceFromThrows(throws: RoundThrow[]): CaddyAdherenceStats {
  const totalThrows = throws.length
  const topPickThrows = throws.filter(t => t.usedRecommendation).length
  const offScriptThrows = totalThrows - topPickThrows

  const offMap = new Map<string, number>()
  for (const t of throws) {
    if (t.usedRecommendation) continue
    offMap.set(t.discName, (offMap.get(t.discName) ?? 0) + 1)
  }
  const offScriptDiscs = [...offMap.entries()]
    .map(([discName, count]) => ({ discName, throws: count }))
    .sort((a, b) => b.throws - a.throws)

  const phaseMap = new Map<ThrowPhase, { total: number; topPickThrows: number }>()
  for (const t of throws) {
    if (!t.throwPhase) continue
    const row = phaseMap.get(t.throwPhase) ?? { total: 0, topPickThrows: 0 }
    row.total += 1
    if (t.usedRecommendation) row.topPickThrows += 1
    phaseMap.set(t.throwPhase, row)
  }
  const byPhase = ([...phaseMap.entries()] as [ThrowPhase, { total: number; topPickThrows: number }][]).map(
    ([throwPhase, row]) => ({
      throwPhase,
      total: row.total,
      topPickThrows: row.topPickThrows,
    }),
  )

  return {
    totalThrows,
    topPickThrows,
    offScriptThrows,
    adherencePct: adherencePct(topPickThrows, totalThrows),
    offScriptDiscs,
    byPhase,
  }
}
