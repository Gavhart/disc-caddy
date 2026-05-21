import {
  BagDisc,
  Disc,
  Hand,
  Hole,
  HoleDirection,
  Recommendation,
  ThrowStyle,
} from '../types'
import { DISC_BY_NAME } from './discs'
import {
  PLASTIC_MODS,
  WEIGHT_MODS,
  WEAR_MODS,
} from './modifiers'
import {
  armSpeedFromMaxDistance,
  requiredArmSpeed,
  designDistance,
} from './armspeed'

interface RecommendOptions {
  bag: BagDisc[]
  hole: Hole
  /** Backhand max distance (the player's "headline" number). */
  playerMaxDistance: number
  /** Forehand max distance. Equals playerMaxDistance when not set. */
  playerForehandDistance?: number
  /** Dominant hand. Defaults to right. */
  hand?: Hand
  /** Whether to consider forehand throws at all. */
  throwsForehand?: boolean
}

/**
 * Tunable coefficients. Adjust as you collect real-world data.
 */
export const MODEL = {
  DEFICIT_TURN_PER_MPH: 0.35,
  DEFICIT_FADE_PER_MPH: 0.25,
  SURPLUS_TURN_PER_MPH: 0.15,
  SURPLUS_FADE_PER_MPH: 0.10,
  SURPLUS_STABILITY_CAP_MPH: 5,
  /** Score weight per foot of distance error. */
  DISTANCE_PENALTY_PER_FT: 1,
  /** Score weight per foot of lateral error. */
  DIRECTION_PENALTY_PER_FT: 1.5,
  /** Distance multiplier cap when player has surplus arm speed. */
  DISTANCE_SURPLUS_CAP: 1.25,
  DISTANCE_SURPLUS_EXPONENT: 0.3,
  DISTANCE_DEFICIT_EXPONENT: 4,
  /**
   * Conversion from stability-units to feet of lateral movement at landing.
   * Rough rule of thumb: a fully overstable driver thrown RHBH ends ~75 ft
   * left of the release line at full distance, with stability ≈ 3.0 →
   * ≈ 25 ft per stability unit. Tunable.
   */
  LATERAL_FT_PER_STABILITY: 25,
  /** Uphill/downhill distance multiplier. Plays-longer factor. */
  UPHILL_FACTOR: 1.10,
  DOWNHILL_FACTOR: 0.90,
  /**
   * Forehand-specific stability adjustments to model the fact that a flick
   * release uses the *opposite* tilt and tends to flutter or hold differently.
   * These coefficients deliberately favor overstable molds for forehand.
   */
  FH_TURN_BONUS: 0.5, // less turn (more resistant)
  FH_FADE_BONUS: 0.5, // a touch more fade
} as const

/**
 * Where the basket sits laterally, in feet, relative to the line from tee to
 * the *projected straight target*. Negative = left of straight; positive = right.
 */
const TARGET_LATERAL: Record<HoleDirection, number> = {
  hard_left: -120,
  dogleg_left: -50,
  straight: 0,
  dogleg_right: 50,
  hard_right: 120,
}

/**
 * Sign factor mapping disc stability to lateral landing direction.
 *
 * Convention in flight ratings: positive `stability` (turn + fade) = overstable
 * = disc finishes on the dominant fade side. For RHBH that's LEFT (negative
 * lateral). Forehand mirrors backhand. LH mirrors RH.
 */
function lateralSign(hand: Hand, style: ThrowStyle): -1 | 1 {
  const rh = hand === 'right'
  const bh = style === 'backhand'
  // RHBH: left = -1; RHFH: right = +1; LHBH: right = +1; LHFH: left = -1.
  if (rh && bh) return -1
  if (rh && !bh) return 1
  if (!rh && bh) return 1
  return -1
}

interface Attempt {
  bagDisc: BagDisc
  disc: Disc
  style: ThrowStyle
}

interface ScoredAttempt {
  attempt: Attempt
  effTurn: number
  effFade: number
  stability: number
  effDistance: number
  predictedLateral: number
  distError: number
  directionError: number
  score: number
}

function scoreAttempt(
  attempt: Attempt,
  hole: Hole,
  hand: Hand,
  armSpeed: number,
): ScoredAttempt {
  const { disc, bagDisc, style } = attempt

  const reqSpeed = requiredArmSpeed(disc.speed)
  const designDist = designDistance(disc.speed)

  const pm = PLASTIC_MODS[bagDisc.plastic]
  const wm = WEIGHT_MODS[bagDisc.weight]
  const rm = WEAR_MODS[bagDisc.wear]

  let totalTurnMod = pm.turn + wm.turn + rm.turn
  let totalFadeMod = pm.fade + wm.fade + rm.fade
  if (style === 'forehand') {
    totalTurnMod += MODEL.FH_TURN_BONUS
    totalFadeMod += MODEL.FH_FADE_BONUS
  }

  // Wind directly affects effective arm speed for this throw.
  const windAdj =
    hole.windDirection === 'Headwind'
      ? hole.windSpeed
      : hole.windDirection === 'Tailwind'
        ? -hole.windSpeed
        : 0
  const effArmSpeed = armSpeed + windAdj

  const deficit = Math.max(0, reqSpeed - effArmSpeed)
  const surplus = Math.min(
    MODEL.SURPLUS_STABILITY_CAP_MPH,
    Math.max(0, effArmSpeed - reqSpeed),
  )

  const turnAdj =
    deficit * MODEL.DEFICIT_TURN_PER_MPH -
    surplus * MODEL.SURPLUS_TURN_PER_MPH
  const fadeAdj =
    deficit * MODEL.DEFICIT_FADE_PER_MPH -
    surplus * MODEL.SURPLUS_FADE_PER_MPH

  const effTurn = disc.turn + totalTurnMod + turnAdj
  const effFade = disc.fade + totalFadeMod + fadeAdj
  const stability = effTurn + effFade

  const ratio = reqSpeed > 0 ? effArmSpeed / reqSpeed : 1
  const efficiency =
    ratio >= 1
      ? Math.min(MODEL.DISTANCE_SURPLUS_CAP, Math.pow(ratio, MODEL.DISTANCE_SURPLUS_EXPONENT))
      : Math.pow(ratio, MODEL.DISTANCE_DEFICIT_EXPONENT)

  // Elevation: uphill plays longer (need more distance), downhill plays shorter.
  const elevationFactor =
    hole.elevation === 'uphill'
      ? MODEL.UPHILL_FACTOR
      : hole.elevation === 'downhill'
        ? MODEL.DOWNHILL_FACTOR
        : 1.0
  const effDistance = Math.round(designDist * efficiency / elevationFactor)

  const predictedLateral =
    stability * MODEL.LATERAL_FT_PER_STABILITY * lateralSign(hand, style)

  const distError = Math.abs(effDistance - hole.distance)
  const directionError = Math.abs(
    predictedLateral - TARGET_LATERAL[hole.direction],
  )

  const score =
    distError * MODEL.DISTANCE_PENALTY_PER_FT +
    directionError * MODEL.DIRECTION_PENALTY_PER_FT

  return {
    attempt,
    effTurn,
    effFade,
    stability,
    effDistance,
    predictedLateral,
    distError,
    directionError,
    score,
  }
}

/**
 * Build a human-readable rationale for a single throw. Rule-based and
 * deterministic. Output shape: "<HandStyleLabel> <release> — <clause>; <clause>."
 *
 * Examples:
 *   "RHBH hyzer — natural fade rides the dogleg left into the basket."
 *   "RHFH flat — overstability holds the line into the headwind."
 *   "RHBH anhyzer — release tilted right and fight the natural fade to hold the line."
 */
function explain(scored: ScoredAttempt, hole: Hole, hand: Hand): string {
  const { attempt, stability, distError, directionError, predictedLateral } = scored
  const { style, disc } = attempt
  const handLabel = hand === 'right' ? 'RH' : 'LH'
  const styleLabel = style === 'backhand' ? 'BH' : 'FH'
  const fadeSign = lateralSign(hand, style) // -1 means natural fade goes LEFT
  const fadeSide: 'left' | 'right' = fadeSign === -1 ? 'left' : 'right'
  const turnSide: 'left' | 'right' = fadeSign === -1 ? 'right' : 'left'

  const holeLeft = hole.direction === 'hard_left' || hole.direction === 'dogleg_left'
  const holeRight = hole.direction === 'hard_right' || hole.direction === 'dogleg_right'

  // Decide the release type that best fits the hole given disc behavior.
  let release: 'hyzer' | 'flat' | 'anhyzer' = 'flat'
  if (stability > 0.5) {
    // Disc fades toward `fadeSide`.
    if ((holeLeft && fadeSide === 'left') || (holeRight && fadeSide === 'right'))
      release = 'hyzer'
    else if ((holeLeft && fadeSide === 'right') || (holeRight && fadeSide === 'left'))
      release = 'anhyzer'
  } else if (stability < -0.5) {
    // Disc turns toward `turnSide` early.
    if ((holeLeft && turnSide === 'left') || (holeRight && turnSide === 'right'))
      release = 'hyzer'
    else if ((holeLeft && turnSide === 'right') || (holeRight && turnSide === 'left'))
      release = 'anhyzer'
  }

  const clauses: string[] = []

  // Direction clause.
  if (release === 'hyzer' && (holeLeft || holeRight)) {
    clauses.push(
      `natural ${stability > 0 ? 'fade' : 'turnover'} rides the ${holeLeft ? 'left' : 'right'} bend into the basket`,
    )
  } else if (release === 'anhyzer') {
    clauses.push(
      `tilt the disc ${holeLeft ? 'left' : 'right'} on release and fight the natural ${stability > 0 ? 'fade' : 'turn'} to hold the line`,
    )
  } else if (hole.direction === 'straight' && Math.abs(stability) < 1) {
    clauses.push('stable through the flight, holds the corridor')
  } else if (hole.direction === 'straight') {
    clauses.push(
      stability > 0
        ? `aim slightly ${turnSide} of the basket so the natural ${fadeSide} fade pulls it home`
        : `aim slightly ${fadeSide} of the basket so the disc works ${turnSide} into line`,
    )
  }

  // Distance clause.
  if (distError > 60) {
    clauses.push(
      scored.effDistance > hole.distance
        ? 'throttle back — there is more disc here than the hole needs'
        : 'longest reach in your bag; plan a touch upshot follow-up',
    )
  } else if (distError > 25) {
    clauses.push(
      scored.effDistance > hole.distance
        ? 'ease off the throw to land the gap'
        : 'commit to a full-power stroke',
    )
  }

  // Wind clause.
  if (hole.windDirection === 'Headwind' && hole.windSpeed > 5) {
    if (stability > 1.5) clauses.push('overstability holds the line into the headwind')
    else if (stability < -1)
      clauses.push('warning: understable in a headwind — release low and hyzer or pick a more stable disc')
  } else if (hole.windDirection === 'Tailwind' && hole.windSpeed > 5) {
    if (stability > 2)
      clauses.push('tailwind kills fade — aim with less hyzer than usual')
  }

  // Elevation clause.
  if (hole.elevation === 'uphill') {
    clauses.push('plays uphill — commit to a clean release')
  } else if (hole.elevation === 'downhill') {
    clauses.push('plays downhill — easy power, let glide do the work')
  }

  // If we still have nothing distinctive, describe the disc.
  if (clauses.length === 0) clauses.push(describeDisc(disc, stability))

  // Direction-miss warning when nothing in the bag actually fits.
  if (directionError > 80 && release !== 'anhyzer') {
    clauses.push(
      `predicted landing ~${Math.round(Math.abs(predictedLateral))} ft ${
        predictedLateral < 0 ? 'left' : 'right'
      } of straight (hole wants ${
        Math.round(Math.abs(TARGET_LATERAL[hole.direction]))
      } ft ${holeLeft ? 'left' : holeRight ? 'right' : ''})`,
    )
  }

  const head = `${handLabel}${styleLabel} ${release}`
  // Capitalize first letter of the first clause for nicer reading.
  const body = clauses.join('; ')
  const bodyCap = body.length > 0 ? body[0].toUpperCase() + body.slice(1) : body
  return `${head} — ${bodyCap}.`
}

function describeDisc(disc: Disc, stability: number): string {
  if (stability > 2.5) return `${disc.name} (${disc.brand}) — overstable, predictable finish`
  if (stability > 1.0) return `${disc.name} (${disc.brand}) — stable with a reliable fade`
  if (stability > -0.5) return `${disc.name} (${disc.brand}) — neutral, holds the corridor`
  if (stability > -1.5) return `${disc.name} (${disc.brand}) — understable, will work over for distance`
  return `${disc.name} (${disc.brand}) — very flippy, easy distance`
}

/**
 * Compute ranked disc + throw-style recommendations for a hole.
 *
 * For each bag disc, we score a backhand attempt and (when enabled) a forehand
 * attempt; both compete on the same leaderboard so the picker may surface a
 * FH option even if a BH alternative with the same disc exists.
 */
export function recommend(opts: RecommendOptions): Recommendation[] {
  const hand: Hand = opts.hand ?? 'right'
  const throwsForehand = opts.throwsForehand ?? false
  const bhArm = armSpeedFromMaxDistance(opts.playerMaxDistance)
  const fhArm = armSpeedFromMaxDistance(
    opts.playerForehandDistance ?? opts.playerMaxDistance,
  )

  const scoredAttempts: ScoredAttempt[] = []
  for (const bagDisc of opts.bag) {
    const disc = DISC_BY_NAME[bagDisc.discName]
    if (!disc) continue
    scoredAttempts.push(
      scoreAttempt({ bagDisc, disc, style: 'backhand' }, opts.hole, hand, bhArm),
    )
    if (throwsForehand) {
      scoredAttempts.push(
        scoreAttempt({ bagDisc, disc, style: 'forehand' }, opts.hole, hand, fhArm),
      )
    }
  }

  scoredAttempts.sort((a, b) => a.score - b.score)

  // De-dupe: keep only the better of {BH, FH} per disc id, so the table
  // doesn't show the same disc twice unless we want to expose both choices.
  const seen = new Set<string>()
  const deduped = scoredAttempts.filter(s => {
    if (seen.has(s.attempt.bagDisc.id)) return false
    seen.add(s.attempt.bagDisc.id)
    return true
  })

  return deduped.map((s, i): Recommendation => ({
    bagDisc: s.attempt.bagDisc,
    disc: s.attempt.disc,
    throwStyle: s.attempt.style,
    effTurn: s.effTurn,
    effFade: s.effFade,
    stability: s.stability,
    effDistance: s.effDistance,
    predictedLateral: s.predictedLateral,
    distError: s.distError,
    directionError: s.directionError,
    score: s.score,
    rank: i + 1,
    pick: i === 0 ? 'TOP PICK' : i === 1 ? 'Alternative' : i === 2 ? 'Backup' : null,
    explanation: explain(s, opts.hole, hand),
  }))
}
