import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  buildHoleShot,
  HoleProgress,
  HoleShot,
  holeProgress,
  shotDistanceFromRemaining,
  summarizeThrowPhases,
} from '../lib/holeShots'
import { throwPhaseLabel } from '../lib/throwPhase'
import { BagDisc, TeeBearing, ThrowStyle } from '../types'
import { HoleProgressMap } from './HoleProgressMap'
import { LieLayoutInput, LieLayoutValue } from './LieLayoutInput'
import { ThrowDistanceMeasure, ThrowMeasureResult } from './ThrowDistanceMeasure'

type EntryMode = 'throw' | 'remaining'

export interface SuggestedThrow {
  bagDiscId: string
  discName: string
  distanceFt: number
  throwStyle: ThrowStyle
}

function styleLabel(style: ThrowStyle): string {
  return style === 'forehand' ? 'Forehand' : 'Backhand'
}

export function HoleShotTracker({
  holeDistance,
  shots,
  onChange,
  bagDiscs,
  primaryThrow,
  teeBearing = 'north',
  suggestedThrow,
  lieLayout,
  baseLayout,
  onLieLayoutChange,
}: {
  holeDistance: number
  shots: HoleShot[]
  onChange: (shots: HoleShot[]) => void
  bagDiscs: BagDisc[]
  primaryThrow: ThrowStyle
  teeBearing?: TeeBearing
  suggestedThrow?: SuggestedThrow | null
  lieLayout?: Partial<LieLayoutValue>
  baseLayout: LieLayoutValue
  onLieLayoutChange?: (patch: Partial<LieLayoutValue>) => void
}) {
  const [mode, setMode] = useState<EntryMode>('throw')
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selectedBagDiscId, setSelectedBagDiscId] = useState('')
  const [throwStyle, setThrowStyle] = useState<ThrowStyle>(primaryThrow)

  const progress: HoleProgress = holeProgress(holeDistance, shots)
  const canAddThrows = progress.status === 'playing'

  const sortedDiscs = useMemo(() => {
    const byName = [...bagDiscs].sort((a, b) => a.discName.localeCompare(b.discName))
    if (!suggestedThrow) return byName
    const suggested = byName.find(d => d.id === suggestedThrow.bagDiscId)
    const rest = byName.filter(d => d.id !== suggestedThrow.bagDiscId)
    return suggested ? [suggested, ...rest] : byName
  }, [bagDiscs, suggestedThrow])

  useEffect(() => {
    setThrowStyle(primaryThrow)
  }, [primaryThrow])

  useEffect(() => {
    if (suggestedThrow?.bagDiscId) {
      setSelectedBagDiscId(suggestedThrow.bagDiscId)
      setThrowStyle(suggestedThrow.throwStyle)
      return
    }
    setSelectedBagDiscId(prev => {
      if (prev && bagDiscs.some(d => d.id === prev)) return prev
      return bagDiscs[0]?.id ?? ''
    })
  }, [suggestedThrow?.bagDiscId, suggestedThrow?.throwStyle, bagDiscs])

  const selectedDisc = bagDiscs.find(d => d.id === selectedBagDiscId) ?? null

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

  function buildShotMeta() {
    if (!selectedDisc) {
      setError('Pick the disc you actually threw.')
      return null
    }
    return {
      bagDiscId: selectedDisc.id,
      discName: selectedDisc.discName,
      throwStyle,
    }
  }

  function addShot(
    distanceFt: number,
    meta?: Partial<
      Pick<HoleShot, 'bagDiscId' | 'discName' | 'throwStyle' | 'landingLat' | 'landingLon'>
    >,
  ) {
    if (distanceFt <= 0) {
      setError('Enter a distance greater than zero.')
      return
    }
    const shotMeta = meta?.bagDiscId
      ? {
          bagDiscId: meta.bagDiscId,
          discName: meta.discName,
          throwStyle: meta.throwStyle,
        }
      : buildShotMeta()
    if (!shotMeta?.bagDiscId || !shotMeta.discName) return

    onChange([
      ...shots,
      buildHoleShot(holeDistance, shots, {
        distanceFt,
        bagDiscId: shotMeta.bagDiscId,
        discName: shotMeta.discName,
        throwStyle: shotMeta.throwStyle ?? throwStyle,
        landingLat: meta?.landingLat,
        landingLon: meta?.landingLon,
      }),
    ])
    setInput('')
    setError(null)
  }

  function parseMeasureResult(result: ThrowMeasureResult | number): {
    distanceFt: number
    landingLat?: number
    landingLon?: number
  } {
    if (typeof result === 'number') return { distanceFt: result }
    return {
      distanceFt: result.distanceFt,
      landingLat: result.landingLat,
      landingLon: result.landingLon,
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canAddThrows) return

    const n = Math.round(Number(input))
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter a valid distance in feet.')
      return
    }

    if (mode === 'throw') {
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
    if (progress.status !== 'playing') return
    addShot(progress.remaining)
  }

  function handleGpsThrow(result: ThrowMeasureResult | number) {
    if (!canAddThrows) return
    const measured = parseMeasureResult(result)
    addShot(measured.distanceFt, measured)
  }

  function handleGpsRemaining(result: ThrowMeasureResult | number) {
    if (!canAddThrows) return
    const measured = parseMeasureResult(result)
    const throwDist = shotDistanceFromRemaining(holeDistance, shots, measured.distanceFt)
    if (throwDist == null || throwDist <= 0) {
      setError('Measured remaining must be less than what you have left to the basket.')
      return
    }
    addShot(throwDist)
  }

  if (holeDistance < 50) return null

  const phaseCounts = summarizeThrowPhases(shots)

  return (
    <section className="card hole-shot-tracker">
      <div className="hole-shot-tracker-head">
        <div>
          <h2>Hole progress</h2>
          <p className="muted small">
            Pick the disc you actually threw, log the distance, and repeat — your bag stats
            update with every throw.
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
          <strong
            className={
              progress.status === 'at_basket'
                ? 'hole-shot-at-basket'
                : progress.status === 'past_basket'
                  ? 'hole-shot-past-basket'
                  : undefined
            }
          >
            {progress.status === 'playing' && `${progress.remaining.toLocaleString()} ft`}
            {progress.status === 'at_basket' && 'At basket'}
            {progress.status === 'past_basket' &&
              `Past basket · ${progress.overshootFt?.toLocaleString()} ft`}
          </strong>
        </div>
        <div>
          <span className="muted small">Throws</span>
          <strong>{shots.length}</strong>
        </div>
      </div>

      {(shots.length > 0 || canAddThrows) && (
        <HoleProgressMap
          holeDistance={holeDistance}
          shots={shots}
          teeBearing={teeBearing}
        />
      )}

      {shots.length > 0 && (
        <div className="hole-shot-phase-summary">
          {(['drive', 'approach', 'putt'] as const).map(phase =>
            phaseCounts[phase] > 0 ? (
              <span key={phase} className={`hole-shot-phase-pill hole-shot-phase-${phase}`}>
                {phaseCounts[phase]} {throwPhaseLabel(phase).toLowerCase()}
                {phaseCounts[phase] === 1 ? '' : 's'}
              </span>
            ) : null,
          )}
        </div>
      )}

      {shots.length > 0 && (
        <ol className="hole-shot-list">
          {shots.map((s, i) => (
            <li key={s.id}>
              <span className="hole-shot-num">{i + 1}</span>
              <span>
                {s.discName ? `${s.discName} · ` : ''}
                {s.throwPhase ? (
                  <span className={`hole-shot-phase-tag hole-shot-phase-${s.throwPhase}`}>
                    {throwPhaseLabel(s.throwPhase)}
                  </span>
                ) : null}
                {s.throwPhase ? ' · ' : ''}
                {s.throwStyle ? `${styleLabel(s.throwStyle)} · ` : ''}
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

      {shots.length > 0 && canAddThrows && onLieLayoutChange && (
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

      {canAddThrows && bagDiscs.length > 0 && (
        <>
          <div className="hole-shot-disc-picker">
            <label>
              Disc you threw
              <select
                value={selectedBagDiscId}
                onChange={e => setSelectedBagDiscId(e.target.value)}
              >
                {sortedDiscs.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.discName}
                    {suggestedThrow?.bagDiscId === d.id ? ' (top pick)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="hole-shot-disc-picker-throw">
              <span className="muted small">Release</span>
              <div className="segmented">
                <button
                  type="button"
                  className={throwStyle === 'backhand' ? 'segmented-on' : undefined}
                  onClick={() => setThrowStyle('backhand')}
                >
                  Backhand
                </button>
                <button
                  type="button"
                  className={throwStyle === 'forehand' ? 'segmented-on' : undefined}
                  onClick={() => setThrowStyle('forehand')}
                >
                  Forehand
                </button>
              </div>
            </div>
          </div>

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

          {mode === 'throw' ? (
            <ThrowDistanceMeasure
              title="GPS throw distance"
              subtitle="Tee/lie → disc"
              copy="Mark where you threw from, walk to your disc, then mark landing to log the throw."
              startLabel="Throw from"
              endLabel="Disc landed"
              markStartLabel="Mark lie"
              markEndLabel="Mark disc"
              onMeasured={handleGpsThrow}
            />
          ) : (
            <ThrowDistanceMeasure
              title="GPS remaining distance"
              subtitle="Disc → basket"
              copy="Stand at your disc, mark your lie, then walk to the basket and mark it to log how far this throw went."
              startLabel="Your lie"
              endLabel="Basket / target"
              markStartLabel="Mark lie"
              markEndLabel="Mark basket"
              onMeasured={handleGpsRemaining}
            />
          )}

          <form onSubmit={handleSubmit} className="hole-shot-form">
            <label>
              {mode === 'throw'
                ? `Or type throw distance (${progress.remaining.toLocaleString()} ft left to basket)`
                : `Or type how far you are from the basket now`}
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
                  placeholder={
                    mode === 'throw'
                      ? String(Math.min(progress.remaining, 240))
                      : String(Math.min(progress.remaining, 180))
                  }
                />
                <span className="suffix">ft</span>
              </div>
            </label>
            <div className="hole-shot-form-actions">
              <button type="submit" className="btn-primary" disabled={!input.trim()}>
                Add throw
              </button>
              {suggestedThrow && mode === 'throw' && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    addShot(Math.min(suggestedThrow.distanceFt, progress.remaining), {
                      bagDiscId: suggestedThrow.bagDiscId,
                      discName: suggestedThrow.discName,
                      throwStyle: suggestedThrow.throwStyle,
                    })
                  }
                >
                  Use top pick (~
                  {Math.min(suggestedThrow.distanceFt, progress.remaining).toLocaleString()} ft)
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={markAtBasket}>
                In the basket
              </button>
            </div>
          </form>
        </>
      )}

      {canAddThrows && bagDiscs.length === 0 && (
        <p className="muted small">Add discs to your bag to log throws.</p>
      )}

      {progress.status === 'at_basket' && (
        <p className="muted small hole-shot-done-msg">
          You&apos;re at the basket — pick a putter and finish the hole. Reset to plan another
          tee shot.
        </p>
      )}

      {progress.status === 'past_basket' && (
        <p className="muted small hole-shot-past-msg">
          That last throw went past the basket. Remove it to fix the distance, or reset the hole
          to start over.
        </p>
      )}

      {error && <p className="hole-shot-error muted small">{error}</p>}
    </section>
  )
}
