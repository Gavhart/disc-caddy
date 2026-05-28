import { FormEvent, useState } from 'react'
import {
  createHoleShot,
  HoleShot,
  remainingHoleDistance,
  shotDistanceFromRemaining,
} from '../lib/holeShots'
import { LieLayoutInput, LieLayoutValue } from './LieLayoutInput'

type EntryMode = 'throw' | 'remaining'

export function HoleShotTracker({
  holeDistance,
  shots,
  onChange,
  suggestedThrow,
  lieLayout,
  baseLayout,
  onLieLayoutChange,
}: {
  holeDistance: number
  shots: HoleShot[]
  onChange: (shots: HoleShot[]) => void
  /** After a recommendation / log throw — one-tap add expected carry. */
  suggestedThrow?: { discName: string; distanceFt: number } | null
  lieLayout?: Partial<LieLayoutValue>
  baseLayout: LieLayoutValue
  onLieLayoutChange?: (patch: Partial<LieLayoutValue>) => void
}) {
  const [mode, setMode] = useState<EntryMode>('throw')
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const remaining = remainingHoleDistance(holeDistance, shots)
  const atBasket = remaining <= 0

  const mergedLieLayout: LieLayoutValue = {
    direction: lieLayout?.direction ?? baseLayout.direction,
    treeCoverage: lieLayout?.treeCoverage ?? baseLayout.treeCoverage,
    treeLayouts: lieLayout?.treeLayouts ?? baseLayout.treeLayouts,
    mandos: lieLayout?.mandos ?? baseLayout.mandos,
  }

  const hasLieOverride = Boolean(
    lieLayout &&
      (lieLayout.direction != null ||
        lieLayout.treeCoverage != null ||
        lieLayout.treeLayouts != null ||
        lieLayout.mandos != null),
  )

  function resetShots() {
    onChange([])
    setInput('')
    setError(null)
    onLieLayoutChange?.({})
  }

  function addShot(distanceFt: number, discName?: string) {
    if (distanceFt <= 0) {
      setError('Enter a distance greater than zero.')
      return
    }
    onChange([...shots, createHoleShot({ distanceFt, discName })])
    setInput('')
    setError(null)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const n = Math.round(Number(input))
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter a valid distance in feet.')
      return
    }

    if (mode === 'throw') {
      if (n > remaining) {
        setError(`That throw is longer than ${remaining.toLocaleString()} ft left.`)
        return
      }
      addShot(n)
      return
    }

    const throwDist = shotDistanceFromRemaining(holeDistance, shots, n)
    if (throwDist == null || throwDist <= 0) {
      setError('Remaining must be less than what you have left to the basket.')
      return
    }
    addShot(throwDist)
  }

  function markAtBasket() {
    if (remaining <= 0) return
    addShot(remaining)
  }

  if (holeDistance < 50) return null

  return (
    <section className="card hole-shot-tracker">
      <div className="hole-shot-tracker-head">
        <div>
          <h2>Hole progress</h2>
          <p className="muted small">
            Add each throw to update what&apos;s left — recommendations adjust for your lie.
          </p>
        </div>
        {shots.length > 0 && (
          <button type="button" className="link-button small" onClick={resetShots}>
            Reset hole
          </button>
        )}
      </div>

      <div className="hole-shot-summary">
        <div>
          <span className="muted small">Hole</span>
          <strong>{holeDistance.toLocaleString()} ft</strong>
        </div>
        <div>
          <span className="muted small">Remaining</span>
          <strong className={atBasket ? 'hole-shot-at-basket' : undefined}>
            {atBasket ? 'At basket' : `${remaining.toLocaleString()} ft`}
          </strong>
        </div>
        <div>
          <span className="muted small">Throws</span>
          <strong>{shots.length}</strong>
        </div>
      </div>

      {shots.length > 0 && (
        <ol className="hole-shot-list">
          {shots.map((s, i) => (
            <li key={s.id}>
              <span className="hole-shot-num">{i + 1}</span>
              <span>
                {s.discName ? `${s.discName} · ` : ''}
                {s.distanceFt.toLocaleString()} ft
              </span>
              <button
                type="button"
                className="link-button small"
                aria-label={`Remove throw ${i + 1}`}
                onClick={() => onChange(shots.filter(x => x.id !== s.id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ol>
      )}

      {shots.length > 0 && !atBasket && onLieLayoutChange && (
        <div className="lie-layout-section lie-layout-section-upsot">
          <div className="lie-layout-section-head">
            <h3>What&apos;s in front of you</h3>
            {hasLieOverride && (
              <button
                type="button"
                className="link-button small"
                onClick={() => onLieLayoutChange({})}
              >
                Reset layout
              </button>
            )}
          </div>
          <p className="muted small">
            Set trees and mandos for your <strong>next throw</strong> — recommendations use
            what&apos;s left plus this layout.
          </p>
          <LieLayoutInput
            value={mergedLieLayout}
            onChange={onLieLayoutChange}
            compact
          />
        </div>
      )}

      {!atBasket && (
        <>
          <div className="hole-shot-mode">
            <span className="muted small">Log as</span>
            <div className="segmented">
              <button
                type="button"
                className={mode === 'throw' ? 'segmented-on' : undefined}
                onClick={() => setMode('throw')}
              >
                Throw went
              </button>
              <button
                type="button"
                className={mode === 'remaining' ? 'segmented-on' : undefined}
                onClick={() => setMode('remaining')}
              >
                Remaining now
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="hole-shot-form">
            <label>
              {mode === 'throw'
                ? `How far did this throw go? (max ${remaining.toLocaleString()} ft)`
                : `How far are you from the basket now?`}
              <div className="input-group">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={input}
                  onChange={e => {
                    if (/^\d*$/.test(e.target.value)) {
                      setInput(e.target.value)
                      setError(null)
                    }
                  }}
                  placeholder={mode === 'throw' ? '240' : String(Math.min(remaining, 180))}
                />
                <span className="suffix">ft</span>
              </div>
            </label>
            <div className="hole-shot-form-actions">
              <button type="submit" className="btn-primary" disabled={!input.trim()}>
                Add throw
              </button>
              {suggestedThrow && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    addShot(
                      Math.min(suggestedThrow.distanceFt, remaining),
                      suggestedThrow.discName,
                    )
                  }
                >
                  Use last pick (~{suggestedThrow.distanceFt} ft)
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={markAtBasket}>
                In the basket
              </button>
            </div>
          </form>
        </>
      )}

      {atBasket && (
        <p className="muted small hole-shot-done-msg">
          You&apos;re at the basket — pick a putter and finish the hole. Reset to plan another
          tee shot.
        </p>
      )}

      {error && <p className="hole-shot-error muted small">{error}</p>}
    </section>
  )
}
