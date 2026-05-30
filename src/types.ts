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
/** @deprecated Legacy bag weight buckets — parsed to grams on read. */
export type Weight = 'Max' | 'Standard' | 'Light'
export type Wear = 'New' | 'Broken In' | 'Beat In'

/** Typical disc golf mold weight range (grams). */
export const WEIGHT_GRAMS_MIN = 120
export const WEIGHT_GRAMS_MAX = 200
export const WEIGHT_GRAMS_DEFAULT = 170

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

/** Which way the tee shot faces toward the basket (compass octant). Used to
 *  rotate live weather into head/tail/cross relative to the line of play. */
export type TeeBearing =
  | 'north'
  | 'northeast'
  | 'east'
  | 'southeast'
  | 'south'
  | 'southwest'
  | 'west'
  | 'northwest'

export const TEE_BEARING_DEG: Record<TeeBearing, number> = {
  north: 0,
  northeast: 45,
  east: 90,
  southeast: 135,
  south: 180,
  southwest: 225,
  west: 270,
  northwest: 315,
}

export const TEE_BEARING_OPTIONS: { value: TeeBearing; label: string }[] = [
  { value: 'north', label: 'N' },
  { value: 'northeast', label: 'NE' },
  { value: 'east', label: 'E' },
  { value: 'southeast', label: 'SE' },
  { value: 'south', label: 'S' },
  { value: 'southwest', label: 'SW' },
  { value: 'west', label: 'W' },
  { value: 'northwest', label: 'NW' },
]

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

/** Mandatory route the disc must pass on the way to the basket. */
export type MandoRoute = 'none' | 'left' | 'right' | 'double' | 'triple'

/** Selected mando markers (multi-select; duplicates allowed for repeated mandos). */
export type ActiveMandoRoute = Exclude<MandoRoute, 'none'>

/** Tree positions that can stack (multi-select). Excludes `none`. */
export type ActiveTreeLayout = Exclude<TreeLayout, 'none'>

export type Hand = 'left' | 'right'
export type ThrowStyle = 'backhand' | 'forehand'

/** A disc as it lives in a bag (one row in bag_discs). */
export interface BagDisc {
  id: string
  bagId: string
  discName: string
  plastic: Plastic
  /** Mold weight in grams (typically 150–180). */
  weightGrams: number
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
  /** Where trees/obstacles sit — tap multiple; repeat a chip for multiples of the same. */
  treeLayouts: ActiveTreeLayout[]
  /** Mandatory routes — tap multiple; repeat for extra mandos on the hole. */
  mandos: ActiveMandoRoute[]
  /** Compass direction the tee faces toward the basket (live wind mapping). */
  teeBearing: TeeBearing
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
  treeLayouts: ActiveTreeLayout[]
  mandos: ActiveMandoRoute[]
  /** Compass direction tee faces toward basket (live wind mapping). */
  teeBearing: TeeBearing
  notes: string | null
  createdBy: string | null
}

/** Hydrated user profile from the 'me' view. */
export interface Me {
  id: string
  email: string | null
  displayName: string | null
  onboardingComplete: boolean
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
  /** Opt-in: visible to other members on the Community page. */
  communityVisible: boolean
  /** Opt-in: open to new card-mates; required to send community messages. */
  lookingForPlayers: boolean
  /** Storage path for profile photo in disc-photos bucket. */
  avatarPath: string | null
  /** Miles to search for community members from saved coordinates. */
  communitySearchRadiusMiles: number
  /** Email alerts for scorecard invites and messages. */
  notifyEmail: boolean
  /** Optional Venmo @username for receiving league payouts. */
  venmoUsername: string | null
}

/** Preset radius options for community search (miles). */
export const COMMUNITY_RADIUS_OPTIONS = [10, 25, 50, 100, 150] as const
export type CommunityRadiusMiles = (typeof COMMUNITY_RADIUS_OPTIONS)[number]

/** A home-area city on the player's profile (up to 3). */
export interface HomeCity {
  city: string
  regionCode: string | null
  countryCode: string | null
  courseId?: string | null
  sortOrder: number
  latitude?: number | null
  longitude?: number | null
}

/** Another opt-in member who shares at least one home city. */
export interface CommunityMember {
  userId: string
  displayName: string
  sharedCityLabels: string[]
  lookingForPlayers: boolean
  /** Approximate distance in miles when matched by GPS radius. */
  distanceMiles: number | null
}

/** In-app message between community members. */
export interface CommunityMessage {
  id: string
  senderId: string
  senderName: string
  recipientId: string
  recipientName: string
  body: string
  createdAt: string
  readAt: string | null
  isInbound: boolean
}

/** Conversation grouped by the other player. */
export interface CommunityThread {
  partnerId: string
  partnerName: string
  lastMessage: CommunityMessage
  unreadCount: number
  messages: CommunityMessage[]
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
  pick: 'TOP PICK' | 'Alternative' | 'Backup' | 'MEMORY' | null
  /** Human-readable rationale: "RHBH hyzer — let the natural fade ride the dogleg." */
  explanation: string
  /** Structured breakdown for the expanded Pro UI. */
  explanationSections: ExplanationSection[]
  /** Feet left (negative) or right (positive) of basket to aim. Null when negligible. */
  aimOffsetFt: number | null
  release: 'hyzer' | 'flat' | 'anhyzer'
}

export interface ExplanationSection {
  title: string
  body: string
}

export interface RoundThrow {
  id: string
  roundId: string
  holeNumber: number
  bagDiscId: string | null
  discName: string
  throwStyle: ThrowStyle
  recommendedRank: number | null
  usedRecommendation: boolean
  notes: string | null
  throwPhase: 'drive' | 'approach' | 'putt' | null
  remainingBeforeFt: number | null
  throwDistanceFt: number | null
  createdAt: string
}

export interface ThrowPhaseStat {
  throwPhase: 'drive' | 'approach' | 'putt'
  throws: number
  avgDistanceFt: number | null
}

export interface DiscPhaseStat {
  discName: string
  throwPhase: 'drive' | 'approach' | 'putt'
  throws: number
  avgDistanceFt: number | null
}

export interface ThrowPhaseStats {
  totals: ThrowPhaseStat[]
  byDisc: DiscPhaseStat[]
}

export interface CaddyAdherenceStats {
  totalThrows: number
  topPickThrows: number
  offScriptThrows: number
  adherencePct: number | null
  offScriptDiscs: { discName: string; throws: number }[]
  byPhase: {
    throwPhase: 'drive' | 'approach' | 'putt'
    total: number
    topPickThrows: number
  }[]
}

/** Prior throw + score on a course hole (Pro hole memory). */
export interface HoleMemory {
  courseId: string
  holeNumber: number
  roundId: string
  bagDiscId: string | null
  discName: string
  throwStyle: ThrowStyle
  strokes: number | null
  par: number | null
  playedAt: string
}

export type AppNotificationKind =
  | 'scorecard_invite'
  | 'community_message'
  | 'friend_activity'
  | 'round_invite'
  | 'scheduled_round'
  | 'challenge_complete'
  | 'league_update'

export type RoundFormat = 'stroke' | 'stableford' | 'skins' | 'best_ball'

export interface FormatStanding {
  playerId?: string
  teamId?: string
  displayName: string
  rank: number
  displayScore: number
  unit: string
  scoreToPar?: number
  stablefordPoints?: number
  skinsWon?: number
}

export interface FormatStandings {
  format: RoundFormat
  standings: FormatStanding[]
}

export interface PlayerStatsDashboard {
  roundsPlayed: number
  avgScoreToPar: number | null
  bestScoreToPar: number | null
  worstScoreToPar: number | null
  totalBirdies: number
  avgPutts: number | null
  roundsLast30d: number
  recentRounds: {
    roundId: string
    scoreToPar: number
    totalStrokes: number
    holesScored: number
    playedAt: string | null
    courseName: string | null
  }[]
}

export interface DiscPerformanceStat {
  discName: string
  throwStyle: ThrowStyle
  throws: number
  avgStrokes: number | null
  avgToPar: number | null
}

export interface PlaybookHole {
  holeNumber: number
  par: number | null
  distance: number | null
  bagDiscId: string | null
  throwStyle: ThrowStyle | null
  aimNotes: string | null
  windNotes: string | null
  strategy: string | null
  holeNote: string | null
  recentScores: { strokes: number; par: number | null; playedAt: string | null }[]
}

export interface Challenge {
  id: string
  slug: string
  title: string
  description: string
  kind: string
  targetValue: number
  startsAt: string
  endsAt: string
  progress: number
  completedAt: string | null
}

export type CommunityEventPostType = 'event' | 'pickup'

/** Events and pickup posts visible within ~75mi of home areas. */
export const COMMUNITY_EVENT_RADIUS_MILES = 75

export interface ScheduledRound {
  id: string
  hostId: string
  hostName: string
  courseId: string | null
  courseName: string | null
  courseLocality: string | null
  scheduledAt: string
  maxPlayers: number
  visibility: 'friends' | 'community'
  status: string
  notes: string | null
  roundId: string | null
  postType: CommunityEventPostType
  distanceMiles: number | null
  goingCount: number
  myRsvp: string | null
}

export interface ScheduledRoundAttendee {
  userId: string
  displayName: string
  status: 'going' | 'maybe'
  createdAt: string
}

export interface League {
  id: string
  name: string
  seasonStart: string
  seasonEnd: string
  format: RoundFormat
  playMode: 'singles' | 'doubles'
  handicapEnabled: boolean
  minRounds: number
  isPublic: boolean
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'all'
  clubId: string | null
  inviteCode: string
  memberCount: number
  createdBy: string
  createdAt: string
  creatorName: string | null
  description: string | null
  location: string | null
  rules: string | null
  myRole: 'admin' | 'member'
  isAdmin: boolean
  roundsSubmitted: number
  playersWithRounds: number
  myRoundsSubmitted: number
  leaderName: string | null
  seasonStatus: 'upcoming' | 'active' | 'ended'
}

export interface LeagueStanding {
  userId: string
  displayName: string
  roundsSubmitted: number
  avgScoreToPar: number | null
  bestScoreToPar: number | null
  avgStablefordPoints: number | null
  bestStablefordPoints: number | null
  avgNetScoreToPar: number | null
  handicapIndex: number | null
  qualified: boolean
  rank: number
}

export interface DiscoverableLeague {
  id: string
  name: string
  description: string | null
  location: string | null
  format: RoundFormat
  playMode: 'singles' | 'doubles'
  skillLevel: League['skillLevel']
  handicapEnabled: boolean
  seasonStart: string
  seasonEnd: string
  inviteCode: string
  memberCount: number
  creatorName: string | null
}

export interface LeaguePair {
  id: string
  name: string | null
  player1Id: string
  player2Id: string
  player1Name: string
  player2Name: string
}

export interface ShuffleLeaguePairsResult {
  pairs: LeaguePair[]
  sitOutUserId: string | null
  sitOutName: string | null
}

export interface LeaguePairStanding {
  pairId: string
  pairName: string
  roundsTogether: number
  avgCombinedToPar: number | null
  rank: number
}

export interface LeagueAnnouncement {
  id: string
  title: string
  body: string
  authorName: string
  createdAt: string
}

export interface LeagueMessage {
  id: string
  body: string
  senderId: string
  senderName: string
  createdAt: string
}

export interface LeaguePot {
  id: string
  label: string
  balanceCents: number
  entryFeeCents: number
  venmoUsername: string | null
}

export interface LeaguePotEntry {
  id: string
  amountCents: number
  note: string | null
  playerName: string
  createdAt: string
}

export interface LeagueRivalry {
  userAId: string
  userBId: string
  userAName: string
  userBName: string
  sharedRounds: number
  aWins: number
  bWins: number
}

export interface LeagueStreak {
  userId: string
  displayName: string
  submittedRounds: number
  avgScoreToPar: number | null
}

export interface LeagueMemberOption {
  userId: string
  displayName: string
}

export interface LeagueSession {
  id: string
  leagueId: string
  sessionDate: string
  courseId: string | null
  status: 'open' | 'closed'
  createdAt: string
  closedAt: string | null
}

export interface LeagueSessionCheckin {
  userId: string
  displayName: string
  checkedInAt: string
  checkedInBy: string
  isMe: boolean
}

export interface LeagueSessionCardMember {
  userId: string
  displayName: string
  sortOrder: number
  isMe: boolean
}

export interface LeagueSessionCard {
  id: string
  sortOrder: number
  label: string
  members: LeagueSessionCardMember[]
}

export interface LeagueTonight {
  session: LeagueSession | null
  checkins: LeagueSessionCheckin[]
  cards: LeagueSessionCard[]
  sitOut: { userId: string; displayName: string } | null
  myCardId: string | null
  checkedInCount: number
  memberCount: number
}

export interface StartLeagueSessionRoundResult {
  roundId: string
  courseId: string
  courseName: string | null
  cardLabel: string
  memberCount: number
}

export interface Club {
  id: string
  name: string
  description: string | null
  location: string | null
  inviteCode: string
  myRole: 'admin' | 'member'
  memberCount: number
}

export interface FriendHeadToHead {
  you: { rounds: number; avgScoreToPar: number | null; bestScoreToPar: number | null }
  friend: { rounds: number; avgScoreToPar: number | null; bestScoreToPar: number | null }
  sharedCourses: {
    courseId: string
    courseName: string
    yourAvg: number | null
    friendAvg: number | null
  }[]
}

export interface NearbyCourse {
  id: string
  name: string
  locality: string | null
  regionCode: string | null
  lat: number | null
  lon: number | null
  distanceMiles: number | null
  roundsLogged: number
}

export interface BagInsights {
  unusedDiscs: { id: string; discName: string }[]
  topDiscs: { discName: string; throws: number }[]
  discCount: number
}

export interface AppNotification {
  id: string
  kind: AppNotificationKind
  title: string
  body: string
  linkPath: string | null
  metadata: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

export interface RoundInvite {
  id: string
  roundId: string
  inviterName: string
  courseName: string | null
  courseId: string | null
  createdAt: string
}

export interface FriendActivity {
  userId: string
  displayName: string
  courseName: string | null
  courseLocality: string | null
  scoreToPar: number
  totalStrokes: number
  playedAt: string
  roundId: string
  highlightPath: string | null
}

export interface PublicRoundRecap {
  courseName: string | null
  courseLocality: string | null
  playedAt: string | null
  status: string
  players: {
    display_name: string
    total_strokes: number
    total_par: number
    score_to_par: number
    holes_scored: number
  }[]
}

export interface PlayerStatsSummary {
  roundsCompleted: number
  birdies: number
  eagles: number
  bestScoreToPar: number | null
  leagueRounds: number
  leagueCount: number
  groupRounds: number
  challengesCompleted: number
  activeDaysLast7: number
  highlightCount: number
}

export interface PlayerBadge {
  slug: string
  title: string
  description: string
  icon: string
  earnedAt: string
}

export interface CourseCheckin {
  userId: string
  displayName: string
  courseId: string
  courseName: string
  courseLocality: string | null
  note: string | null
  checkedInAt: string
}

export interface MyCourseCheckin {
  courseId: string
  courseName: string
  courseLocality: string | null
  note: string | null
  checkedInAt: string
}

export interface RoundHighlight {
  id: string
  storagePath: string
  caption: string | null
  createdAt: string
  userId: string
}

export interface RoundPlayer {
  id: string
  roundId: string
  userId: string | null
  displayName: string
  isHost: boolean
  sortOrder: number
  createdAt: string
}

export interface RoundScore {
  id: string
  roundId: string
  roundPlayerId: string
  holeNumber: number
  strokes: number
  putts: number | null
  par: number | null
  updatedAt: string
}

export interface RoundSummary {
  id: string
  courseId: string | null
  courseName: string | null
  courseLocality: string | null
  bagId: string | null
  status: 'active' | 'completed'
  format: RoundFormat
  startedAt: string
  endedAt: string | null
  hostUserId: string
  holesScored: number
  totalStrokes: number
  totalPar: number
  scoreToPar: number
  playerCount: number
}

export interface RoundDetail extends RoundSummary {
  players: RoundPlayer[]
  scores: RoundScore[]
  throws: RoundThrow[]
}

export interface PlayerSearchResult {
  userId: string
  displayName: string
  email: string
}

export interface Friend {
  userId: string
  displayName: string
  email: string
}

export interface FriendRequest {
  id: string
  fromUserId: string
  displayName: string
  email: string
  createdAt: string
}

export interface LeaderboardEntry {
  rank: number
  roundPlayerId: string
  roundId: string
  userId: string | null
  displayName: string
  strokes: number
  par: number | null
  scoreToPar: number
  holesScored: number
  playedAt: string
}
