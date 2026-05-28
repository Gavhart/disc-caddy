import {
  ActiveMandoRoute,
  ActiveTreeLayout,
  Hole,
  HoleDirection,
  MandoRoute,
  TreeCoverage,
  TreeLayout,
} from '../types'

export const DIRECTION_OPTIONS: { value: HoleDirection; label: string }[] = [
  { value: 'hard_left', label: 'Hard left' },
  { value: 'dogleg_left', label: 'Dogleg left' },
  { value: 'straight', label: 'Straight' },
  { value: 'dogleg_right', label: 'Dogleg right' },
  { value: 'hard_right', label: 'Hard right' },
]

export const TREE_COVERAGE_OPTIONS: { value: TreeCoverage; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'light', label: 'Light' },
  { value: 'wooded', label: 'Wooded' },
  { value: 'heavily_wooded', label: 'Heavy' },
]

export const TREE_LAYOUT_OPTIONS: { value: ActiveTreeLayout; label: string }[] = [
  { value: 'throughout', label: 'Throughout' },
  { value: 'front_half', label: 'Front half' },
  { value: 'back_half', label: 'Back half' },
  { value: 'left', label: 'Left side' },
  { value: 'right', label: 'Right side' },
  { value: 'canopy', label: 'Low canopy' },
]

/** Multi-select chips — no "none"; tap again to remove one instance. */
export const MANDO_MULTI_OPTIONS: { value: ActiveMandoRoute; label: string }[] = [
  { value: 'left', label: 'Mando left' },
  { value: 'right', label: 'Mando right' },
  { value: 'double', label: 'Double mando' },
  { value: 'triple', label: 'Triple mando' },
]

/** @deprecated single-select list — use MANDO_MULTI_OPTIONS */
export const MANDO_OPTIONS: { value: MandoRoute; label: string }[] = [
  { value: 'none', label: 'None' },
  ...MANDO_MULTI_OPTIONS,
]

/** Add/remove one instance (duplicates allowed). */
export function toggleMulti<T>(values: T[], item: T): T[] {
  const idx = values.indexOf(item)
  if (idx >= 0) return [...values.slice(0, idx), ...values.slice(idx + 1)]
  return [...values, item]
}

export function countInMulti<T>(values: T[], item: T): number {
  return values.filter(v => v === item).length
}

export function treeLayoutsForCoverage(
  coverage: TreeCoverage,
  layouts: ActiveTreeLayout[],
): ActiveTreeLayout[] {
  if (coverage === 'open') return []
  return layouts
}

export type LegacyHoleLayout = {
  treeCoverage?: TreeCoverage
  treeLayouts?: ActiveTreeLayout[]
  treeLayout?: TreeLayout
  mandos?: ActiveMandoRoute[]
  mando?: MandoRoute
}

/** Hydrate arrays from legacy single-value hole snapshots. */
export function normalizeHoleLayoutFields(
  raw: LegacyHoleLayout,
): { treeLayouts: ActiveTreeLayout[]; mandos: ActiveMandoRoute[] } {
  let treeLayouts: ActiveTreeLayout[] = []
  if (Array.isArray(raw.treeLayouts)) {
    treeLayouts = [...raw.treeLayouts]
  } else if (raw.treeLayout && raw.treeLayout !== 'none') {
    treeLayouts = [raw.treeLayout as ActiveTreeLayout]
  }

  let mandos: ActiveMandoRoute[] = []
  if (Array.isArray(raw.mandos)) {
    mandos = [...raw.mandos]
  } else if (raw.mando && raw.mando !== 'none') {
    mandos = [raw.mando]
  }

  if (raw.treeCoverage === 'open') treeLayouts = []

  return { treeLayouts, mandos }
}

export function formatMultiChipLabel(base: string, count: number): string {
  return count > 1 ? `${base} ×${count}` : base
}

export function holeMandos(hole: Hole | LegacyHoleLayout): ActiveMandoRoute[] {
  return normalizeHoleLayoutFields(hole).mandos
}

export function holeTreeLayouts(hole: Hole | LegacyHoleLayout): ActiveTreeLayout[] {
  return normalizeHoleLayoutFields(hole).treeLayouts
}

/** Score penalty from mandatory routes (stacks with duplicates). */
export function mandoComplexPenalty(mandos: ActiveMandoRoute[]): number {
  let p = 0
  for (const m of mandos) {
    if (m === 'double') p += 18
    if (m === 'triple') p += 28
  }
  const left = mandos.filter(m => m === 'left').length
  const right = mandos.filter(m => m === 'right').length
  if (left >= 1 && right >= 1) p += 18
  if (mandos.includes('triple') || left + right >= 3) p += 10
  return p
}
