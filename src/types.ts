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
export type WindDirection = 'None' | 'Headwind' | 'Tailwind'

/** Hole bend, signed (left/right) with severity. */
export type HoleDirection =
  | 'hard_left'
  | 'dogleg_left'
  | 'straight'
  | 'dogleg_right'
  | 'hard_right'

export type Elevation = 'uphill' | 'flat' | 'downhill'

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
  source: 'user' | 'discgolfapi'
  sourceId: string | null
  createdBy: string | null
  createdAt: string
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
  notes: string | null
  createdBy: string | null
}

/** Hydrated user profile from the 'me' view. */
export interface Me {
  id: string
  email: string | null
  maxDistance: number
  dominantHand: Hand
  throwsForehand: boolean
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
