import { BagDisc, Hole } from '../types'

const DEMO_BAG_ID = 'demo-bag'

function demoDisc(name: string, position: number): BagDisc {
  return {
    id: `demo-${name.toLowerCase().replace(/\s+/g, '-')}`,
    bagId: DEMO_BAG_ID,
    discName: name,
    plastic: 'Premium',
    weightGrams: 173,
    wear: 'Broken In',
    photoPath: null,
    position,
  }
}

/** Sample bag for the public Caddy demo — real flight numbers from the catalog. */
export const DEMO_BAG: BagDisc[] = [
  demoDisc('Destroyer', 0),
  demoDisc('Buzzz', 1),
  demoDisc('Roc3', 2),
  demoDisc('Zone', 3),
  demoDisc('Aviar', 4),
]

/** Pier Park–style wooded par 3 with a gentle left dogleg. */
export const DEMO_HOLE: Hole = {
  distance: 310,
  direction: 'dogleg_left',
  elevation: 'flat',
  terrain: 'rolling',
  treeCoverage: 'wooded',
  treeLayouts: ['throughout'],
  mandos: [],
  teeBearing: 'north',
  windDirection: 'headwind',
  windSpeed: 8,
}

export const DEMO_PLAYER = {
  maxDistance: 280,
  putterMaxDistance: 140,
  midrangeMaxDistance: 196,
  fairwayMaxDistance: 238,
  forehandMaxDistance: 250,
  hand: 'right' as const,
  throwsForehand: true,
  primaryThrow: 'backhand' as const,
}

export const DEMO_COURSE_LABEL = 'Sample wooded par 3 · 310 ft · 8 mph headwind'
