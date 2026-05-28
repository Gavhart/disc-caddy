import { Hole } from '../types'
import { normalizeHoleLayoutFields } from './holeLayoutOptions'
import type { LieLayoutValue } from '../components/LieLayoutInput'

export function holeToLieLayout(hole: Hole): LieLayoutValue {
  const { treeLayouts, mandos } = normalizeHoleLayoutFields(hole)
  return {
    direction: hole.direction,
    treeCoverage: hole.treeCoverage,
    treeLayouts,
    mandos,
  }
}

export function applyLieLayout(hole: Hole, lieLayout: Partial<LieLayoutValue>): Hole {
  const next = { ...hole }
  if (lieLayout.direction != null) next.direction = lieLayout.direction
  if (lieLayout.treeCoverage != null) {
    next.treeCoverage = lieLayout.treeCoverage
    if (lieLayout.treeCoverage === 'open') next.treeLayouts = []
  }
  if (lieLayout.treeLayouts != null) next.treeLayouts = lieLayout.treeLayouts
  if (lieLayout.mandos != null) next.mandos = lieLayout.mandos
  return next
}

/** Whether a lie-layout override object has any active fields. */
export function hasLieLayoutOverride(lieLayout: Partial<LieLayoutValue>): boolean {
  return (
    lieLayout.direction != null ||
    lieLayout.treeCoverage != null ||
    lieLayout.treeLayouts != null ||
    lieLayout.mandos != null
  )
}
