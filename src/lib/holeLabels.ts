import {
  Hole,
  HoleDirection,
  Elevation,
  Terrain,
  TreeCoverage,
  ActiveTreeLayout,
  ActiveMandoRoute,
} from '../types'
import { normalizeHoleLayoutFields } from './holeLayoutOptions'

export function formatDirection(d: HoleDirection): string {
  switch (d) {
    case 'hard_left':
      return 'Hard left'
    case 'dogleg_left':
      return 'Dogleg left'
    case 'straight':
      return 'Straight'
    case 'dogleg_right':
      return 'Dogleg right'
    case 'hard_right':
      return 'Hard right'
  }
}

export function formatElevation(e: Elevation): string {
  switch (e) {
    case 'uphill':
      return 'Uphill'
    case 'flat':
      return 'Flat'
    case 'downhill':
      return 'Downhill'
  }
}

function formatTerrain(t: Terrain): string {
  switch (t) {
    case 'flat':
      return 'Flat terrain'
    case 'rolling':
      return 'Rolling'
    case 'hilly':
      return 'Hilly'
    case 'mountainous':
      return 'Mountainous'
  }
}

const TREE_LAYOUT_LABELS: Record<ActiveTreeLayout, string> = {
  throughout: 'throughout',
  front_half: 'front half',
  back_half: 'back half',
  left: 'left side',
  right: 'right side',
  canopy: 'canopy',
}

function formatTreeLayoutItem(layout: ActiveTreeLayout): string {
  return TREE_LAYOUT_LABELS[layout] ?? layout
}

function formatTrees(c: TreeCoverage, layouts: ActiveTreeLayout[]): string | null {
  if (c === 'open') return null
  const density =
    c === 'light' ? 'Light trees' : c === 'wooded' ? 'Wooded' : 'Heavily wooded'
  if (layouts.length === 0) return density

  const counts = new Map<ActiveTreeLayout, number>()
  for (const l of layouts) {
    counts.set(l, (counts.get(l) ?? 0) + 1)
  }
  const where = [...counts.entries()]
    .map(([layout, n]) =>
      n > 1 ? `${formatTreeLayoutItem(layout)} ×${n}` : formatTreeLayoutItem(layout),
    )
    .join(', ')
  return `${density} (${where})`
}

const MANDO_LABELS: Record<ActiveMandoRoute, string> = {
  left: 'Mando left',
  right: 'Mando right',
  double: 'Double mando',
  triple: 'Triple mando',
}

function formatMandos(mandos: ActiveMandoRoute[]): string | null {
  if (mandos.length === 0) return null
  const counts = new Map<ActiveMandoRoute, number>()
  for (const m of mandos) {
    counts.set(m, (counts.get(m) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([m, n]) => (n > 1 ? `${MANDO_LABELS[m]} ×${n}` : MANDO_LABELS[m]))
    .join(', ')
}

/** One-line hole layout for banners and summaries. */
export function summarizeHoleLayout(hole: Hole): string {
  const { treeLayouts, mandos } = normalizeHoleLayoutFields(hole)
  const parts = [
    `${hole.distance} ft`,
    formatDirection(hole.direction),
    formatElevation(hole.elevation),
  ]
  if (hole.terrain !== 'flat') parts.push(formatTerrain(hole.terrain))
  const trees = formatTrees(hole.treeCoverage, treeLayouts)
  if (trees) parts.push(trees)
  const mando = formatMandos(mandos)
  if (mando) parts.push(mando)
  return parts.join(' · ')
}
