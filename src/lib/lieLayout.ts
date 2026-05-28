import { Hole } from '../types'
import type { LieLayoutValue } from '../components/LieLayoutInput'

export function holeToLieLayout(hole: Hole): LieLayoutValue {
  return {
    direction: hole.direction,
    treeCoverage: hole.treeCoverage,
    treeLayout: hole.treeLayout,
    mando: hole.mando ?? 'none',
  }
}

export function applyLieLayout(hole: Hole, lieLayout: Partial<LieLayoutValue>): Hole {
  return {
    ...hole,
    ...(lieLayout.direction != null ? { direction: lieLayout.direction } : {}),
    ...(lieLayout.treeCoverage != null ? { treeCoverage: lieLayout.treeCoverage } : {}),
    ...(lieLayout.treeLayout != null ? { treeLayout: lieLayout.treeLayout } : {}),
    ...(lieLayout.mando != null ? { mando: lieLayout.mando } : {}),
  }
}

/** Whether a lie-layout override object has any active fields. */
export function hasLieLayoutOverride(lieLayout: Partial<LieLayoutValue>): boolean {
  return (
    lieLayout.direction != null ||
    lieLayout.treeCoverage != null ||
    lieLayout.treeLayout != null ||
    lieLayout.mando != null
  )
}
