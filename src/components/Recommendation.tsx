import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Hand, Recommendation as Rec, ThrowStyle } from '../types'
import { ProGate } from './ProGate'

interface Props {
  recommendations: Rec[]
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
  loggedHoleNumber?: number | null
  currentHoleNumber?: number | null
  onLogThrow?: (rec: Rec) => Promise<void>
  holeMemoryMessage?: string | null
  memorySelection?: { bagDiscId: string; throwStyle: ThrowStyle } | null
  holeDistance?: number
  remainingDistance?: number
  shotCount?: number
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
  hand,
  primaryThrow,
  profileHand,
  profilePrimaryThrow,
  onHandChange,
  onPrimaryThrowChange,
  getDiscRecommendation,
  roundActive = false,
  isPro = false,
  loggedHoleNumber = null,
  currentHoleNumber = null,
  onLogThrow,
  holeMemoryMessage = null,
  memorySelection = null,
  holeDistance,
  remainingDistance,
  shotCount = 0,
}: Props) {
  const top = recommendations[0]
  const [selectedBagDiscId, setSelectedBagDiscId] = useState<string | null>(null)
  const [discThrowOverride, setDiscThrowOverride] = useState<ThrowStyle | null>(null)

  const usingProfileDefaults =
    hand === profileHand && primaryThrow === profilePrimaryThrow

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

  const alreadyLogged =
    loggedHoleNumber != null &&
    currentHoleNumber != null &&
    loggedHoleNumber === currentHoleNumber

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

      {shotCount > 0 && remainingDistance != null && (
        <p className="recommendation-lie-banner muted small">
          Picking for <strong>{remainingDistance.toLocaleString()} ft</strong> remaining
          {remainingDistance <= 120 ? ' — upshot range' : ''}.
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
            {recommendations.map(r => (
              <option key={r.bagDisc.id} value={r.bagDisc.id}>
                {r.bagDisc.discName}
                {r.rank === 1 ? ' (top pick)' : ''}
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
              alreadyLogged ? (
                <span className="pill small">Logged for this hole ✓</span>
              ) : (
                <button
                  type="button"
                  className="btn-primary pick-log-btn"
                  onClick={() => onLogThrow(displayed)}
                >
                  Log this throw
                </button>
              )
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
        <details className="alternatives" open>
          <summary>All picks ranked</summary>
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
              {recommendations.map(r => {
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
        </details>
      )}
    </section>
  )
}
