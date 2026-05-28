import { Hole, HoleDirection, Elevation, Terrain, TreeCoverage, TreeLayout, MandoRoute } from '../types'

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

function formatTrees(c: TreeCoverage, layout: TreeLayout): string | null {
  if (c === 'open') return null
  const density =
    c === 'light' ? 'Light trees' : c === 'wooded' ? 'Wooded' : 'Heavily wooded'
  if (!layout || layout === 'none' || layout === 'throughout') return density
  const where =
    layout === 'front_half'
      ? 'front half'
      : layout === 'back_half'
        ? 'back half'
        : layout === 'left'
          ? 'left side'
          : layout === 'right'
            ? 'right side'
            : layout === 'canopy'
              ? 'Canopy'
              : ''
  return where ? `${density} (${where})` : density
}

function formatMando(m: MandoRoute): string | null {
  switch (m) {
    case 'left':
      return 'Mando left'
    case 'right':
      return 'Mando right'
    case 'double':
      return 'Double mando'
    case 'triple':
      return 'Triple mando'
    case 'none':
      return null
  }
}

/** One-line hole layout for banners and summaries. */
export function summarizeHoleLayout(hole: Hole): string {
  const parts = [
    `${hole.distance} ft`,
    formatDirection(hole.direction),
    formatElevation(hole.elevation),
  ]
  if (hole.terrain !== 'flat') parts.push(formatTerrain(hole.terrain))
  const trees = formatTrees(hole.treeCoverage, hole.treeLayout)
  if (trees) parts.push(trees)
  const mando = formatMando(hole.mando ?? 'none')
  if (mando) parts.push(mando)
  return parts.join(' · ')
}
