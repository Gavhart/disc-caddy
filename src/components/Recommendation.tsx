import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { HoleProgressStatus } from '../lib/holeShots'
import { nextThrowPhase, throwPhasePickLabel } from '../lib/throwPhase'
import { BagDisc, Hand, Recommendation as Rec, ThrowStyle } from '../types'
import { ProGate } from './ProGate'

interface Props {
  recommendations: Rec[]
  bagDiscs: BagDisc[]
  hand: Hand
  primaryThrow: ThrowStyle
  profileHand: Hand
  profilePrimaryThrow: ThrowStyle
  onHandChange: (hand: Hand) => void
  onPrimaryThrowChange: (style: ThrowStyle) => void
  getDiscRecommendation?: (
    bagDiscId: string,
    throwStyle?: ThrowStyle,
  ) => Rec | null
  roundActive?: boolean
  isPro?: boolean
  currentHoleNumber?: number | null
  onLogThrow?: (rec: Rec) => Promise<void>
  holeMemoryMessage?: string | null
  memorySelection?: { bagDiscId: string; throwStyle: ThrowStyle } | null
  holeDistance?: number
  remainingDistance?: number
  shotCount?: number
  shotProgressStatus?: HoleProgressStatus
  overshootFt?: number
}

function styleLabel(style: Rec['throwStyle']): string {
  return style === 'forehand' ? 'Forehand' : 'Backhand'
}

function releaseLabel(release: Rec['release']): string {
  if (release === 'hyzer') return 'Hyzer'
  if (release === 'anhyzer') return 'Anhyzer'
  return 'Flat'
}

function handLabel(hand: Hand): string {
  return hand === 'left' ? 'Left' : 'Right'
}

export function Recommendation({
  recommendations,
  bagDiscs,
  hand,
  primaryThrow,
  profileHand,
  profilePrimaryThrow,
  onHandChange,
  onPrimaryThrowChange,
  getDiscRecommendation,
  roundActive = false,
  isPro = false,
  currentHoleNumber = null,
  onLogThrow,
  holeMemoryMessage = null,
  memorySelection = null,
  holeDistance,
  remainingDistance,
  shotCount = 0,
  shotProgressStatus = 'playing',
  overshootFt,
}: Props) {
  const top = recommendations[0]
  const [selectedBagDiscId, setSelectedBagDiscId] = useState<string | null>(null)
  const [discThrowOverride, setDiscThrowOverride] = useState<ThrowStyle | null>(null)
  const [showAllPicks, setShowAllPicks] = useState(false)

  const VISIBLE_PICKS = 5
  const visibleRecommendations = showAllPicks
    ? recommendations
    : recommendations.slice(0, VISIBLE_PICKS)
  const hiddenPickCount = Math.max(0, recommendations.length - VISIBLE_PICKS)

  const recommendedIds = useMemo(
    () => new Set(recommendations.map(r => r.bagDisc.id)),
    [recommendations],
  )
  const rankedDiscOptions = useMemo(() => {
    const seen = new Set<string>()
    const options: { id: string; name: string; rank: number }[] = []
    for (const r of recommendations) {
      if (seen.has(r.bagDisc.id)) continue
      seen.add(r.bagDisc.id)
      options.push({ id: r.bagDisc.id, name: r.bagDisc.discName, rank: r.rank })
    }
    return options
  }, [recommendations])
  const otherBagDiscs = useMemo(
    () =>
      [...bagDiscs]
        .filter(d => !recommendedIds.has(d.id))
        .sort((a, b) => a.discName.localeCompare(b.discName)),
    [bagDiscs, recommendedIds],
  )

  const usingProfileDefaults =
    hand === profileHand && primaryThrow === profilePrimaryThrow

  useEffect(() => {
    setShowAllPicks(false)
  }, [recommendations, currentHoleNumber, shotCount, remainingDistance])

  useEffect(() => {
    if (memorySelection) {
      setSelectedBagDiscId(memorySelection.bagDiscId)
      setDiscThrowOverride(memorySelection.throwStyle)
      return
    }
    setSelectedBagDiscId(null)
    setDiscThrowOverride(null)
  }, [
    memorySelection?.bagDiscId,
    memorySelection?.throwStyle,
    currentHoleNumber,
    top?.bagDisc.id,
    top?.throwStyle,
  ])

  const activeThrowStyle = discThrowOverride ?? primaryThrow

  const displayed = useMemo(() => {
    if (!top) return null
    if (!selectedBagDiscId || !getDiscRecommendation) return top
    return (
      getDiscRecommendation(selectedBagDiscId, activeThrowStyle) ??
      top
    )
  }, [top, selectedBagDiscId, activeThrowStyle, getDiscRecommendation])

  if (!top || !displayed) {
    if (holeDistance != null && holeDistance < 50) {
      return (
        <section className="card">
          <h2>Recommendation</h2>
          <p className="muted">Enter a hole distance (50–1,500 ft) to see disc picks.</p>
        </section>
      )
    }
    return (
      <section className="card">
        <h2>Recommendation</h2>
        <p className="muted">Add discs to your bag to see recommendations.</p>
      </section>
    )
  }

  const usingTopPick =
    selectedBagDiscId == null ||
    (selectedBagDiscId === top.bagDisc.id &&
      discThrowOverride == null &&
      displayed.throwStyle === top.throwStyle)

  const pickLabel = displayed.pick === 'MEMORY'
    ? 'RECOMMENDED AGAIN'
    : usingTopPick
      ? shotCount > 0
        ? 'NEXT SHOT'
        : top.pick === 'MEMORY'
          ? 'RECOMMENDED AGAIN'
          : top.pick ?? 'TOP PICK'
      : displayed.rank > 0
        ? `#${displayed.rank} in your bag`
        : 'YOUR PICK'

  function selectDisc(bagDiscId: string, throwStyle?: ThrowStyle) {
    if (bagDiscId === top.bagDisc.id && throwStyle == null) {
      setSelectedBagDiscId(null)
      setDiscThrowOverride(null)
      return
    }
    setSelectedBagDiscId(bagDiscId)
    setDiscThrowOverride(throwStyle ?? null)
  }

  function handleHandChange(next: Hand) {
    onHandChange(next)
    setDiscThrowOverride(null)
  }

  function handlePrimaryThrowChange(next: ThrowStyle) {
    onPrimaryThrowChange(next)
    setDiscThrowOverride(null)
  }

  return (
    <section className="card recommendation">
      <h2>Recommendation</h2>

      {shotCount > 0 && shotProgressStatus === 'playing' && remainingDistance != null && (
        <p className="recommendation-lie-banner muted small">
          <strong>{throwPhasePickLabel(nextThrowPhase(remainingDistance), remainingDistance)}</strong>
        </p>
      )}

      {shotCount > 0 && shotProgressStatus === 'past_basket' && overshootFt != null && (
        <p className="recommendation-lie-banner muted small">
          Last throw went <strong>{overshootFt.toLocaleString()} ft</strong> past the basket —
          fix the throw in Hole progress or reset the hole.
        </p>
      )}

      {isPro && holeMemoryMessage && shotCount === 0 && (
        <div className="hole-memory-banner">
          <span className="hole-memory-badge">Hole memory</span>
          <p>{holeMemoryMessage}</p>
        </div>
      )}

      {!isPro && currentHoleNumber != null && (
        <ProGate feature="Hole memory">
          {' '}
          Pick a course hole as Pro to recall your last disc and result here.
        </ProGate>
      )}

      <div className="pick-chooser">
        <div className="pick-chooser-field">
          <span>Hand</span>
          <div className="segmented">
            <button
              type="button"
              className={hand === 'right' ? 'segmented-on' : undefined}
              onClick={() => handleHandChange('right')}
            >
              Right
            </button>
            <button
              type="button"
              className={hand === 'left' ? 'segmented-on' : undefined}
              onClick={() => handleHandChange('left')}
            >
              Left
            </button>
          </div>
        </div>

        <div className="pick-chooser-field">
          <span>Throw</span>
          <div className="segmented">
            <button
              type="button"
              className={primaryThrow === 'backhand' ? 'segmented-on' : undefined}
              onClick={() => handlePrimaryThrowChange('backhand')}
            >
              Backhand
            </button>
            <button
              type="button"
              className={primaryThrow === 'forehand' ? 'segmented-on' : undefined}
              onClick={() => handlePrimaryThrowChange('forehand')}
            >
              Forehand
            </button>
          </div>
        </div>

        <label className="pick-chooser-field">
          <span>Using disc</span>
          <select
            value={selectedBagDiscId ?? top.bagDisc.id}
            onChange={e => {
              const id = e.target.value
              if (id === top.bagDisc.id) {
                selectDisc(top.bagDisc.id)
              } else {
                selectDisc(id)
              }
            }}
          >
            {rankedDiscOptions.length > 0 && (
              <optgroup label="Ranked picks">
                {rankedDiscOptions.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                    {d.rank === 1 ? ' (top pick)' : ` (#${d.rank})`}
                  </option>
                ))}
              </optgroup>
            )}
            {otherBagDiscs.length > 0 && (
              <optgroup label="Rest of bag">
                {otherBagDiscs.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.discName}
                  </option>
                ))}
              </optgroup>
            )}
            {recommendations.length === 0 &&
              bagDiscs.map(d => (
                <option key={d.id} value={d.id}>
                  {d.discName}
                </option>
              ))}
          </select>
        </label>
      </div>

      {!usingProfileDefaults && (
        <p className="muted small pick-profile-hint">
          Using {handLabel(hand)} hand · {styleLabel(primaryThrow)} for this hole
          {hand !== profileHand || primaryThrow !== profilePrimaryThrow
            ? ` (profile: ${handLabel(profileHand)} · ${styleLabel(profilePrimaryThrow)})`
            : ''}
          . Change anytime — saved in Settings when you update your profile.
        </p>
      )}

      <div className="top-pick">
        <div className="pick-label">{pickLabel.toUpperCase()}</div>
        <div className="pick-disc">
          {displayed.bagDisc.discName}
          <span className="pill small pick-throw">
            {styleLabel(displayed.throwStyle)}
          </span>
          <span className="pill small pick-release">
            {releaseLabel(displayed.release)}
          </span>
        </div>
        <div className="pick-detail">
          {displayed.bagDisc.plastic} · {displayed.bagDisc.weightGrams}g ·{' '}
          {displayed.bagDisc.wear}
        </div>
        <div className="pick-rationale">{displayed.explanation}</div>

        {displayed.explanationSections.length > 0 && (
          <div className="pick-sections">
            {displayed.explanationSections.map(section => (
              <div key={section.title} className="pick-section">
                <div className="pick-section-title">{section.title}</div>
                <div className="pick-section-body">{section.body}</div>
              </div>
            ))}
          </div>
        )}

        <div className="pick-flight">
          Eff flight: <strong>{displayed.effTurn.toFixed(1)}</strong> /{' '}
          <strong>{displayed.effFade.toFixed(1)}</strong>
          <span className="dot">·</span>
          Stability <strong>{displayed.stability.toFixed(1)}</strong>
          <span className="dot">·</span>
          Distance <strong>{displayed.effDistance} ft</strong>
          {displayed.aimOffsetFt != null && displayed.aimOffsetFt !== 0 && (
            <>
              <span className="dot">·</span>
              Aim{' '}
              <strong>
                {Math.abs(displayed.aimOffsetFt)} ft{' '}
                {displayed.aimOffsetFt < 0 ? 'left' : 'right'}
              </strong>
            </>
          )}
        </div>

        {!usingTopPick && (
          <p className="muted small pick-reset">
            <button
              type="button"
              className="link-button"
              onClick={() => selectDisc(top.bagDisc.id)}
            >
              Back to top pick
            </button>
          </p>
        )}

        {roundActive && onLogThrow && (
          <div className="pick-actions">
            {isPro ? (
              <>
                <button
                  type="button"
                  className="btn-secondary pick-log-btn"
                  onClick={() => onLogThrow(displayed)}
                >
                  Log {displayed.bagDisc.discName} for stats
                </button>
                <p className="muted small pick-log-hint">
                  Log each throw with distance in <strong>Hole progress</strong> below — pick any
                  disc from your bag, not just the top recommendation.
                </p>
              </>
            ) : (
              <p className="muted small">
                <Link to="/upgrade" className="link-button">
                  Upgrade to Pro
                </Link>{' '}
                to log throws during a live round.
              </p>
            )}
          </div>
        )}
      </div>
      {recommendations.length > 1 && (
        <div className="alternatives">
          <div className="alternatives-head">
            <h3>Ranked picks</h3>
            <span className="muted small">
              Top {Math.min(VISIBLE_PICKS, recommendations.length)} of {recommendations.length}
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Disc</th>
                <th>Throw</th>
                <th>Stab</th>
                <th>Dist</th>
                <th>Pick</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecommendations.map(r => {
                const selected =
                  displayed.bagDisc.id === r.bagDisc.id &&
                  displayed.throwStyle === r.throwStyle
                return (
                  <tr
                    key={`${r.bagDisc.id}-${r.throwStyle}`}
                    className={`${r.rank <= 3 ? 'ranked' : ''}${selected ? ' pick-row-selected' : ''}`}
                  >
                    <td>{r.rank}</td>
                    <td>
                      <button
                        type="button"
                        className="link-button pick-row-btn"
                        onClick={() => selectDisc(r.bagDisc.id, r.throwStyle)}
                      >
                        <div>{r.bagDisc.discName}</div>
                        <div className="muted small">
                          {r.bagDisc.plastic} · {r.bagDisc.wear}
                        </div>
                      </button>
                    </td>
                    <td>{styleLabel(r.throwStyle)}</td>
                    <td>{r.stability.toFixed(2)}</td>
                    <td>{r.effDistance}</td>
                    <td>{r.pick === 'MEMORY' ? 'Memory' : (r.pick ?? '')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {hiddenPickCount > 0 && (
            <button
              type="button"
              className="btn-secondary alternatives-more-btn"
              onClick={() => setShowAllPicks(prev => !prev)}
            >
              {showAllPicks
                ? 'Show top 5 only'
                : `Show ${hiddenPickCount} more pick${hiddenPickCount === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
