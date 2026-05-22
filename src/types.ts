// ---------- Disc / flight model ----------
export type DiscType = 'Putter' | 'Midrange' | 'Fairway' | 'Distance'

export interface Disc {
  name: string
  brand: string
  /** Optional: present when sourced from the curated catalog. */
  type?: DiscType
  speed: number
  glide: number
  turn: number
  fade: number
  /** Manufacturer-published gram range, e.g. "150-176". Catalog metadata only. */
  weight?: string
}

export type Plastic = 'Premium' | 'Base' | 'Glow'
export type Weight = 'Max' | 'Standard' | 'Light'
export type Wear = 'New' | 'Broken In' | 'Beat In'

/**
 * Wind direction expressed as a compass-style relative bearing. The eight
 * named directions correspond to where the wind is coming *from* relative to
 * the line of play (basket = forward). Diagonals are 45° between cardinals.
 *
 *  - `headwind`        — straight into your face (from front)
 *  - `tailwind`        — at your back (from behind)
 *  - `from_left`       — pure crosswind, pushes the disc right
 *  - `from_right`      — pure crosswind, pushes the disc left
 *  - `head_from_left`  — diagonal: head + push-right
 *  - `head_from_right` — diagonal: head + push-left
 *  - `tail_from_left`  — diagonal: tail + push-right
 *  - `tail_from_right` — diagonal: tail + push-left
 */
export type WindDirection =
  | 'none'
  | 'headwind'
  | 'head_from_left'
  | 'head_from_right'
  | 'from_left'
  | 'from_right'
  | 'tailwind'
  | 'tail_from_left'
  | 'tail_from_right'

/** Hole bend, signed (left/right) with severity. */
export type HoleDirection =
  | 'hard_left'
  | 'dogleg_left'
  | 'straight'
  | 'dogleg_right'
  | 'hard_right'

export type Elevation = 'uphill' | 'flat' | 'downhill'

/** Fairway relief independent of net elevation change. */
export type Terrain = 'flat' | 'rolling' | 'hilly' | 'mountainous'

/** Tree density along the line of play. */
export type TreeCoverage = 'open' | 'light' | 'wooded' | 'heavily_wooded'

/** Where the trees sit relative to the line of play. `none` = no notable
 *  trees, or trees-but-unspecified-position. */
export type TreeLayout =
  | 'none'
  | 'throughout'
  | 'front_half'
  | 'back_half'
  | 'left'
  | 'right'
  | 'canopy'

export type Hand = 'left' | 'right'
export type ThrowStyle = 'backhand' | 'forehand'

/** A disc as it lives in a bag (one row in bag_discs). */
export interface BagDisc {
  id: string
  bagId: string
  discName: string
  plastic: Plastic
  weight: Weight
  wear: Wear
  /** Supabase Storage path. Resolve to a URL with getDiscPhotoUrl(). */
  photoPath: string | null
  position: number
}

/** A named bag belonging to a user. */
export interface Bag {
  id: string
  userId: string
  name: string
  isDefault: boolean
  createdAt: string
}

/** Combined bag + discs (used by the recommendation engine). */
export interface BagWithDiscs extends Bag {
  discs: BagDisc[]
}

export interface Hole {
  distance: number
  direction: HoleDirection
  elevation: Elevation
  terrain: Terrain
  treeCoverage: TreeCoverage
  treeLayout: TreeLayout
  windDirection: WindDirection
  windSpeed: number
}

/** A reusable shared course. */
export interface Course {
  id: string
  name: string
  locality: string | null
  regionCode: string | null
  countryCode: string | null
  lat: number | null
  lon: number | null
  /** Expected hole count (from DiscGolfAPI metadata, or user-provided). */
  totalHoles: number | null
  source: 'user' | 'discgolfapi'
  sourceId: string | null
  createdBy: string | null
  createdAt: string
}

/** Per-course aggregate stats. Sourced from the `course_summaries` view. */
export interface CourseSummary {
  courseId: string
  /** Expected hole count (mirrors Course.totalHoles for convenience). */
  totalHoles: number | null
  /** How many holes have actually been entered for this course. */
  holesFilled: number
  /** Sum of distances over filled holes, in feet. 0 when no holes filled. */
  distanceTotalFt: number
  /** Average distance over filled holes, in feet. null when no holes filled. */
  distanceAvgFt: number | null
}

/** One playable hole on a course (shared, user-entered). */
export interface CourseHole {
  id: string
  courseId: string
  number: number
  distance: number
  par: number | null
  direction: HoleDirection
  elevation: Elevation
  terrain: Terrain
  treeCoverage: TreeCoverage
  treeLayout: TreeLayout
  notes: string | null
  createdBy: string | null
}

/** Hydrated user profile from the 'me' view. */
export interface Me {
  id: string
  email: string | null
  /** Backhand max distance with a driver. The headline number. */
  maxDistance: number
  /** Resolved by the `me` view: explicit value, else 50% of maxDistance. */
  putterMaxDistance: number
  /** Resolved by the `me` view: explicit value, else 70% of maxDistance. */
  midrangeMaxDistance: number
  /** Resolved by the `me` view: explicit value, else 85% of maxDistance. */
  fairwayMaxDistance: number
  dominantHand: Hand
  /** Whether forehand is in the player's bag at all. Gates whether the
   *  recommender considers FH attempts. */
  throwsForehand: boolean
  /** Player's preferred release. The recommender breaks ties in this
   *  style's favor when scoring picks. Implies `throwsForehand === true`
   *  when set to `'forehand'`. */
  primaryThrow: ThrowStyle
  /** Resolved at view time: falls back to maxDistance when null. */
  forehandMaxDistance: number
  subscriptionTier: 'free' | 'pro'
  subscriptionStatus:
    | 'free'
    | 'active'
    | 'canceled'
    | 'past_due'
    | 'trialing'
  subscriptionPeriodEnd: string | null
  isPro: boolean
}

export interface Recommendation {
  bagDisc: BagDisc
  disc: Disc
  /** How to throw it for this recommendation. */
  throwStyle: ThrowStyle
  effTurn: number
  effFade: number
  stability: number
  effDistance: number
  /** Signed lateral landing offset in feet: negative = left of target, positive = right. */
  predictedLateral: number
  distError: number
  directionError: number
  score: number
  rank: number
  pick: 'TOP PICK' | 'Alternative' | 'Backup' | null
  /** Human-readable rationale: "RHBH hyzer — let the natural fade ride the dogleg." */
  explanation: string
}
