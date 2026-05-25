import {
  BagDisc,
  Disc,
  DiscType,
  Hand,
  Hole,
  HoleDirection,
  ExplanationSection,
  Recommendation,
  ThrowStyle,
  TreeCoverage,
  WindDirection,
} from '../types'
import { DISC_BY_NAME } from './discs'
import {
  PLASTIC_MODS,
  WEAR_MODS,
  weightModsForGrams,
} from './modifiers'
import {
  armSpeedFromMaxDistance,
  requiredArmSpeed,
} from './armspeed'

interface RecommendOptions {
  bag: BagDisc[]
  hole: Hole
  /** Backhand max distance with a driver (the player's headline number). */
  playerMaxDistance: number
  /** Backhand max with a putter. Defaults to 50% of playerMaxDistance. */
  playerPutterDistance?: number
  /** Backhand max with a midrange. Defaults to 70% of playerMaxDistance. */
  playerMidrangeDistance?: number
  /** Backhand max with a fairway driver. Defaults to 85% of playerMaxDistance. */
  playerFairwayDistance?: number
  /** Forehand max distance (single number for all FH throws). */
  playerForehandDistance?: number
  /** Dominant hand. Defaults to right. */
  hand?: Hand
  /** Whether to consider forehand throws at all. */
  throwsForehand?: boolean
  /** Preferred release. The recommender adds a small score penalty to
   *  attempts in the *other* style so that, all else equal, the player's
   *  preferred shot wins ties. Does NOT gate FH on/off — that's
   *  `throwsForehand`'s job. Defaults to backhand. */
  primaryThrow?: ThrowStyle
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
  /**
   * Flat penalty added to any attempt whose throw style isn't the player's
   * `primaryThrow`. Sized so the off-style throw has to be roughly this many
   * feet *more accurate* in combined distance+direction error to overtake
   * the preferred style. 15 keeps the bias modest — clearly-better off-style
   * shots still win, but coin-flip comparisons tilt to the player's
   * comfortable release.
   */
  STYLE_PREFERENCE_PENALTY: 15,
  /**
   * Wind distance modulation, per mph of head/tail wind. Heads shorten,
   * tails extend. Slightly asymmetric (headwind drag hurts more than
   * tailwind helps for typical disc shapes).
   */
  HEADWIND_DIST_PER_MPH: 0.015,
  TAILWIND_DIST_PER_MPH: 0.010,
  WIND_DIST_MULT_MIN: 0.6,
  WIND_DIST_MULT_MAX: 1.25,
  /**
   * Lateral drift caused by a 1 mph pure crosswind over a 300 ft flight.
   * Drift scales linearly with wind speed *and* with effective distance —
   * a putter floats with the wind for less of the flight than a driver
   * does. ~3 ft / mph at 300 ft matches what most players see in practice.
   */
  CROSS_DRIFT_FT_PER_MPH_AT_300: 3,
  /**
   * Crosswind stability shift, in stability points per mph. A crosswind
   * blowing *into* the disc's fade side pushes it down on that side → more
   * hyzer → more fade-like behavior. A crosswind hitting the opposite side
   * lifts it → flip-up behavior. Universal coefficient; the spin-direction
   * sign comes from `lateralSign(hand, style)`.
   *
   * Split evenly across turn and fade so both flight numbers stay
   * internally consistent for the explanation logic.
   */
  CROSS_STAB_PER_MPH: 0.15,
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
  /**
   * Tree-coverage penalties. Each entry is the score added to discs that
   * fight tight-fairway play: distance drivers (speed ≥ 10) navigate trees
   * poorly, and very high or very low stability creates unpredictable kicks
   * in the foliage. Open fairways get a zero penalty.
   */
  TREE_PENALTY: {
    open:            { driver: 0,  highStab: 0,  flippy: 0  },
    light:           { driver: 5,  highStab: 0,  flippy: 0  },
    wooded:          { driver: 15, highStab: 8,  flippy: 4  },
    heavily_wooded:  { driver: 30, highStab: 20, flippy: 10 },
  } satisfies Record<
    TreeCoverage,
    { driver: number; highStab: number; flippy: number }
  >,
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
 * Decompose a compass wind direction into head and cross components
 * (each ranges -1..+1). Multiply by `windSpeed` to get the mph along each
 * axis. Diagonals get √2/2 ≈ 0.71 in both axes so the magnitude still
 * matches the user's stated speed.
 *
 *  - `head`  positive = headwind (slows/destabilizes), negative = tailwind
 *  - `cross` positive = pushing the disc right, negative = pushing it left
 */
const DIAG = 0.7071 // cos(45°)
const WIND_COMPONENTS: Record<WindDirection, { head: number; cross: number }> = {
  none:             { head:  0,    cross:  0    },
  headwind:         { head:  1,    cross:  0    },
  head_from_left:   { head:  DIAG, cross:  DIAG },
  head_from_right:  { head:  DIAG, cross: -DIAG },
  from_left:        { head:  0,    cross:  1    },
  from_right:       { head:  0,    cross: -1    },
  tailwind:         { head: -1,    cross:  0    },
  tail_from_left:   { head: -DIAG, cross:  DIAG },
  tail_from_right:  { head: -DIAG, cross: -DIAG },
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
  /**
   * Baseline distance for this disc-and-style combo, in feet. Comes from the
   * player's stated per-type max (BH) or single forehand distance (FH). The
   * scorer uses this directly as the no-wind/no-elevation effective distance
   * rather than re-deriving it from arm speed and the disc's design speed.
   */
  baselineDistance: number
}

/**
 * Infer a disc's type when the catalog entry doesn't carry one (rare:
 * legacy hardcoded molds before the snapshot import). Speed-only fallback.
 */
function inferType(disc: Disc): DiscType {
  if (disc.type) return disc.type
  if (disc.speed <= 3) return 'Putter'
  if (disc.speed <= 5) return 'Midrange'
  if (disc.speed <= 9) return 'Fairway'
  return 'Distance'
}

/**
 * Pick the right baseline distance for an attempt. Backhand uses the player's
 * per-type number; forehand uses the single forehand-distance number for all
 * disc types (most flick players track only one FH distance).
 */
function pickBaseline(disc: Disc, style: ThrowStyle, opts: RecommendOptions): number {
  if (style === 'forehand') {
    return opts.playerForehandDistance ?? opts.playerMaxDistance
  }
  const t = inferType(disc)
  switch (t) {
    case 'Putter':
      return opts.playerPutterDistance ?? Math.round(opts.playerMaxDistance * 0.5)
    case 'Midrange':
      return opts.playerMidrangeDistance ?? Math.round(opts.playerMaxDistance * 0.7)
    case 'Fairway':
      return opts.playerFairwayDistance ?? Math.round(opts.playerMaxDistance * 0.85)
    case 'Distance':
      return opts.playerMaxDistance
  }
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
  const { disc, bagDisc, style, baselineDistance } = attempt

  const reqSpeed = requiredArmSpeed(disc.speed)

  const pm = PLASTIC_MODS[bagDisc.plastic]
  const wm = weightModsForGrams(bagDisc.weightGrams)
  const rm = WEAR_MODS[bagDisc.wear]

  let totalTurnMod = pm.turn + wm.turn + rm.turn
  let totalFadeMod = pm.fade + wm.fade + rm.fade
  if (style === 'forehand') {
    totalTurnMod += MODEL.FH_TURN_BONUS
    totalFadeMod += MODEL.FH_FADE_BONUS
  }

  // Decompose wind into head + cross components. The head component drives
  // stability and distance behavior (a head/left wind affects stability with
  // only its head fraction, not the full speed). The cross component drives
  // lateral drift further down in this function.
  const windCmp = WIND_COMPONENTS[hole.windDirection] ?? WIND_COMPONENTS.none
  const windHeadMph = windCmp.head * hole.windSpeed
  const windCrossMph = windCmp.cross * hole.windSpeed
  const effArmSpeed = armSpeed + windHeadMph

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

  // Crosswind stability shift.
  //
  // Spin direction (set by hand + throw style via `lateralSign`) decides
  // which side of the disc gets pushed by a given crosswind:
  //
  //   - Counterclockwise spin (RHBH, LHFH; lateralSign = -1):
  //       wind from the right (cross < 0) hits the fade side → more fade.
  //       wind from the left  (cross > 0) hits the opposite side → more turn.
  //   - Clockwise spin (LHBH, RHFH; lateralSign = +1): mirrored.
  //
  // The product `windCrossMph * lateralSign` is positive when the wind is
  // pushing the disc TOWARD its natural fade side (more overstable), and
  // negative when pushing AWAY (more understable). Split evenly so that
  // effTurn and effFade both shift; the explanation logic reads each.
  const stabCrossDelta =
    windCrossMph * lateralSign(hand, style) * MODEL.CROSS_STAB_PER_MPH
  const crossTurnAdj = stabCrossDelta * 0.5
  const crossFadeAdj = stabCrossDelta * 0.5

  const effTurn = disc.turn + totalTurnMod + turnAdj + crossTurnAdj
  const effFade = disc.fade + totalFadeMod + fadeAdj + crossFadeAdj
  const stability = effTurn + effFade

  // Distance: the player's measured per-type baseline already accounts for
  // their arm speed with that disc class, so we *don't* re-scale by arm-speed
  // efficiency. Only wind and elevation perturb the baseline. Only the
  // head/tail component of the wind affects distance — pure crosswinds drift
  // the disc but don't shorten or lengthen the throw materially.
  let windDistMult = 1
  if (windHeadMph > 0) {
    windDistMult = 1 - windHeadMph * MODEL.HEADWIND_DIST_PER_MPH
  } else if (windHeadMph < 0) {
    windDistMult = 1 + -windHeadMph * MODEL.TAILWIND_DIST_PER_MPH
  }
  windDistMult = Math.max(
    MODEL.WIND_DIST_MULT_MIN,
    Math.min(MODEL.WIND_DIST_MULT_MAX, windDistMult),
  )

  const elevationFactor =
    hole.elevation === 'uphill'
      ? MODEL.UPHILL_FACTOR
      : hole.elevation === 'downhill'
        ? MODEL.DOWNHILL_FACTOR
        : 1.0
  const effDistance = Math.round((baselineDistance * windDistMult) / elevationFactor)

  // Lateral landing: disc's natural fade/turn behavior PLUS any crosswind
  // drift. Crosswind drift scales with effective distance (a putter spends
  // less time in the wind than a driver does).
  const stabilityLateral =
    stability * MODEL.LATERAL_FT_PER_STABILITY * lateralSign(hand, style)
  const crossDrift =
    windCrossMph
    * MODEL.CROSS_DRIFT_FT_PER_MPH_AT_300
    * (effDistance / 300)
  const predictedLateral = stabilityLateral + crossDrift

  const distError = Math.abs(effDistance - hole.distance)
  const directionError = Math.abs(
    predictedLateral - TARGET_LATERAL[hole.direction],
  )

  // Tree-coverage penalty: prefer controllable molds when the fairway is
  // tight. Distance drivers cost more to navigate; very high (or very low)
  // stability creates unpredictable kicks off trees.
  const treeCfg = MODEL.TREE_PENALTY[hole.treeCoverage] ?? MODEL.TREE_PENALTY.open
  let treePenalty = 0
  if (disc.speed >= 10) treePenalty += treeCfg.driver
  if (stability > 2)   treePenalty += treeCfg.highStab
  if (stability < -2)  treePenalty += treeCfg.flippy

  const score =
    distError * MODEL.DISTANCE_PENALTY_PER_FT +
    directionError * MODEL.DIRECTION_PENALTY_PER_FT +
    treePenalty

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

interface ExplanationDetail {
  summary: string
  sections: ExplanationSection[]
  aimOffsetFt: number | null
  release: 'hyzer' | 'flat' | 'anhyzer'
}

/**
 * Build a human-readable rationale for a single throw. Rule-based and
 * deterministic. Output shape: "<HandStyleLabel> <release> — <clause>; <clause>."
 */
function explain(scored: ScoredAttempt, hole: Hole, hand: Hand): ExplanationDetail {
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

  // Wind clauses. Build from the head/cross decomposition so diagonals get
  // both halves of the description.
  if (hole.windSpeed > 0 && hole.windDirection !== 'none') {
    const cmp = WIND_COMPONENTS[hole.windDirection]
    const headMph = Math.abs(cmp.head * hole.windSpeed)
    const crossMph = Math.abs(cmp.cross * hole.windSpeed)

    if (cmp.head > 0 && headMph > 5) {
      if (stability > 1.5) clauses.push('overstability holds the line into the headwind')
      else if (stability < -1)
        clauses.push('warning: understable in a headwind — release low and hyzer or pick a more stable disc')
    } else if (cmp.head < 0 && headMph > 5) {
      if (stability > 2)
        clauses.push('tailwind kills fade — aim with less hyzer than usual')
    }

    if (crossMph > 4) {
      // Cross-wind direction: positive cross drift = pushed right.
      const blowingTo: 'left' | 'right' = cmp.cross > 0 ? 'right' : 'left'
      const blowingFrom: 'left' | 'right' = blowingTo === 'right' ? 'left' : 'right'
      // Whether the wind helps the disc reach the target laterally or fights it.
      const targetLateral = TARGET_LATERAL[hole.direction]
      const drift = cmp.cross * hole.windSpeed
      const helpsTarget = (drift > 0 && targetLateral > 0) || (drift < 0 && targetLateral < 0)
      if (hole.direction === 'straight') {
        clauses.push(
          `crosswind from the ${blowingFrom} — aim a touch ${blowingFrom} of the basket to let it drift in`,
        )
      } else if (helpsTarget) {
        clauses.push(`crosswind helps push toward the ${blowingTo}-side target`)
      } else {
        clauses.push(`crosswind fights the line — needs more disc the other way`)
      }

      // Stability-shift clause: when the crosswind is strong enough (>6 mph
      // of cross component), call out the spin-direction interaction so the
      // player knows *why* the engine is favoring one mold over another.
      //   reinforces > 0  → wind pushes disc toward its fade side (more stable)
      //   reinforces < 0  → wind lifts the disc (more understable / flippy)
      if (crossMph > 6) {
        const reinforces = drift * fadeSign
        if (reinforces > 0 && stability > 1) {
          clauses.push(
            'crosswind hits the fade side — disc will finish harder than rated',
          )
        } else if (reinforces < 0 && stability < 0.5) {
          clauses.push(
            'crosswind lifts the disc — understable molds will flip up; lean more stable',
          )
        } else if (reinforces < 0 && stability > 2) {
          clauses.push(
            'crosswind softens the natural fade — usual hyzer will hold its line longer',
          )
        }
      }
    }
  }

  // Elevation clause.
  if (hole.elevation === 'uphill') {
    clauses.push('plays uphill — commit to a clean release')
  } else if (hole.elevation === 'downhill') {
    clauses.push('plays downhill — easy power, let glide do the work')
  }

  // Terrain clause: highlight when the fairway itself is bumpy enough to
  // affect skip/roll, separate from net elevation change.
  if (hole.terrain === 'hilly' || hole.terrain === 'mountainous') {
    clauses.push(
      'hilly fairway — expect funky skips, plan for a softer landing',
    )
  }

  // Tree clauses: density first, then where they sit (so the player knows
  // *when* in the flight the gap closes).
  if (hole.treeCoverage === 'wooded' || hole.treeCoverage === 'heavily_wooded') {
    const tight = hole.treeCoverage === 'heavily_wooded'
    clauses.push(
      tight
        ? 'tight tree gauntlet — predictability beats power'
        : 'wooded line — a controllable mid usually beats forcing a driver',
    )
    if (hole.treeLayout === 'back_half') {
      clauses.push('trees crowd the back half — pick a disc that lands soft')
    } else if (hole.treeLayout === 'front_half') {
      clauses.push('trees up front — open release window, then it clears')
    } else if (hole.treeLayout === 'canopy') {
      clauses.push('low canopy — keep it flat and under the ceiling')
    } else if (hole.treeLayout === 'left' || hole.treeLayout === 'right') {
      clauses.push(`trees crowd the ${hole.treeLayout} side — bias the other way`)
    }
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
  const body = clauses.join('; ')
  const bodyCap = body.length > 0 ? body[0].toUpperCase() + body.slice(1) : body
  const summary = `${head} — ${bodyCap}.`

  const targetLateral = TARGET_LATERAL[hole.direction]
  const aimOffsetFt =
    Math.abs(predictedLateral - targetLateral) > 12
      ? Math.round(targetLateral - predictedLateral)
      : null

  const sections: ExplanationSection[] = [
    {
      title: 'Release',
      body: `${handLabel}${styleLabel} ${release} with ${disc.name}. Natural finish trends ${fadeSide}.`,
    },
  ]

  if (aimOffsetFt != null && aimOffsetFt !== 0) {
    sections.push({
      title: 'Aim point',
      body: `Aim ~${Math.abs(aimOffsetFt)} ft ${aimOffsetFt < 0 ? 'left' : 'right'} of the basket to account for fade and wind drift.`,
    })
  }

  if (scored.effDistance !== hole.distance) {
    sections.push({
      title: 'Power',
      body:
        distError > 60
          ? scored.effDistance > hole.distance
            ? `Expected ~${scored.effDistance} ft — throttle back; the hole is only ${hole.distance} ft.`
            : `Expected ~${scored.effDistance} ft — max power; you're ${hole.distance - scored.effDistance} ft short of the gap.`
          : `Expected carry ~${scored.effDistance} ft on a ${hole.distance} ft hole.`,
    })
  }

  const conditionNotes = clauses.filter(
    c =>
      c.includes('wind') ||
      c.includes('uphill') ||
      c.includes('downhill') ||
      c.includes('tree') ||
      c.includes('wooded') ||
      c.includes('canopy') ||
      c.includes('hilly'),
  )
  if (conditionNotes.length > 0) {
    sections.push({
      title: 'Conditions',
      body: conditionNotes.map(c => c[0].toUpperCase() + c.slice(1)).join('. ') + '.',
    })
  } else if (bodyCap) {
    sections.push({ title: 'Notes', body: bodyCap + '.' })
  }

  return { summary, sections, aimOffsetFt, release }
}

function scoredToRecommendation(
  s: ScoredAttempt,
  hole: Hole,
  hand: Hand,
  meta: { rank: number; pick: Recommendation['pick'] },
): Recommendation {
  const detail = explain(s, hole, hand)
  return {
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
    rank: meta.rank,
    pick: meta.pick,
    explanation: detail.summary,
    explanationSections: detail.sections,
    aimOffsetFt: detail.aimOffsetFt,
    release: detail.release,
  }
}

function scoreDiscAttempt(
  bagDisc: BagDisc,
  disc: Disc,
  style: ThrowStyle,
  opts: RecommendOptions,
  hand: Hand,
): ScoredAttempt {
  const primaryThrow: ThrowStyle = opts.primaryThrow ?? 'backhand'
  const arm =
    style === 'forehand'
      ? armSpeedFromMaxDistance(
          opts.playerForehandDistance ?? opts.playerMaxDistance,
        )
      : armSpeedFromMaxDistance(opts.playerMaxDistance)
  const baseline = pickBaseline(disc, style, opts)
  const scored = scoreAttempt(
    { bagDisc, disc, style, baselineDistance: baseline },
    opts.hole,
    hand,
    arm,
  )
  if (style !== primaryThrow) {
    scored.score += MODEL.STYLE_PREFERENCE_PENALTY
  }
  return scored
}

/**
 * Build throw guidance for one bag disc. When `throwStyle` is omitted, picks
 * the better of backhand vs forehand (when forehand is enabled).
 */
export function recommendForDisc(
  opts: RecommendOptions,
  bagDiscId: string,
  throwStyle?: ThrowStyle,
): Recommendation | null {
  const bagDisc = opts.bag.find(d => d.id === bagDiscId)
  if (!bagDisc) return null
  const disc = DISC_BY_NAME[bagDisc.discName]
  if (!disc) return null

  const hand: Hand = opts.hand ?? 'right'
  const primaryThrow: ThrowStyle = opts.primaryThrow ?? 'backhand'
  const throwsForehand =
    (opts.throwsForehand ?? false) || primaryThrow === 'forehand'

  let best: ScoredAttempt
  if (throwStyle === 'backhand') {
    best = scoreDiscAttempt(bagDisc, disc, 'backhand', opts, hand)
  } else if (throwStyle === 'forehand') {
    if (!throwsForehand) return null
    best = scoreDiscAttempt(bagDisc, disc, 'forehand', opts, hand)
  } else {
    const bh = scoreDiscAttempt(bagDisc, disc, 'backhand', opts, hand)
    if (!throwsForehand) {
      best = bh
    } else {
      const fh = scoreDiscAttempt(bagDisc, disc, 'forehand', opts, hand)
      best = bh.score <= fh.score ? bh : fh
    }
  }

  const all = recommend(opts)
  const match = all.find(
    r => r.bagDisc.id === bagDiscId && r.throwStyle === best.attempt.style,
  )
  return scoredToRecommendation(best, opts.hole, hand, {
    rank: match?.rank ?? 0,
    pick: match?.pick ?? null,
  })
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
  // `primaryThrow === 'forehand'` implies the player throws forehand; treat it
  // as a soft enable so the recommender still produces FH picks if the
  // caller forgot to also set `throwsForehand: true`.
  const primaryThrow: ThrowStyle = opts.primaryThrow ?? 'backhand'
  const throwsForehand =
    (opts.throwsForehand ?? false) || primaryThrow === 'forehand'
  const bhArm = armSpeedFromMaxDistance(opts.playerMaxDistance)
  const fhArm = armSpeedFromMaxDistance(
    opts.playerForehandDistance ?? opts.playerMaxDistance,
  )

  const scoredAttempts: ScoredAttempt[] = []
  for (const bagDisc of opts.bag) {
    const disc = DISC_BY_NAME[bagDisc.discName]
    if (!disc) continue
    const bhBaseline = pickBaseline(disc, 'backhand', opts)
    const bhScored = scoreAttempt(
      { bagDisc, disc, style: 'backhand', baselineDistance: bhBaseline },
      opts.hole,
      hand,
      bhArm,
    )
    if (primaryThrow !== 'backhand') {
      bhScored.score += MODEL.STYLE_PREFERENCE_PENALTY
    }
    scoredAttempts.push(bhScored)
    if (throwsForehand) {
      const fhBaseline = pickBaseline(disc, 'forehand', opts)
      const fhScored = scoreAttempt(
        { bagDisc, disc, style: 'forehand', baselineDistance: fhBaseline },
        opts.hole,
        hand,
        fhArm,
      )
      if (primaryThrow !== 'forehand') {
        fhScored.score += MODEL.STYLE_PREFERENCE_PENALTY
      }
      scoredAttempts.push(fhScored)
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

  return deduped.map((s, i): Recommendation => {
    return scoredToRecommendation(s, opts.hole, hand, {
      rank: i + 1,
      pick: i === 0 ? 'TOP PICK' : i === 1 ? 'Alternative' : i === 2 ? 'Backup' : null,
    })
  })
}
