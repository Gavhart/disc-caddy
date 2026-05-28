import { useState } from 'react'
import {
  bearingToTeeBearing,
  clampHoleDistanceFeet,
  haversineFeet,
  initialBearingDegrees,
} from '../lib/geo'
import { getPreciseLocation, LocationError, PreciseLocation } from '../lib/weather'
import { TeeBearing } from '../types'

function formatAccuracy(meters: number | null): string {
  if (meters == null) return ''
  if (meters < 1) return ' (< 1 m)'
  return ` (±${Math.round(meters)} m)`
}

function combinedAccuracy(a: PreciseLocation, b: PreciseLocation): number | null {
  if (a.accuracyMeters == null && b.accuracyMeters == null) return null
  const aa = a.accuracyMeters ?? 0
  const bb = b.accuracyMeters ?? 0
  return Math.round(Math.sqrt(aa * aa + bb * bb))
}

export function HoleDistanceMeasure({
  onMeasured,
}: {
  onMeasured: (result: { distanceFt: number; teeBearing: TeeBearing }) => void
}) {
  const [tee, setTee] = useState<PreciseLocation | null>(null)
  const [busy, setBusy] = useState<'tee' | 'basket' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resultLabel, setResultLabel] = useState<string | null>(null)

  async function markTee() {
    setBusy('tee')
    setError(null)
    setResultLabel(null)
    try {
      const fix = await getPreciseLocation()
      setTee(fix)
    } catch (err) {
      setError(err instanceof LocationError ? err.message : 'Could not mark tee location')
    } finally {
      setBusy(null)
    }
  }

  async function markBasket() {
    if (!tee) return
    setBusy('basket')
    setError(null)
    try {
      const basket = await getPreciseLocation()
      const rawFeet = haversineFeet(tee.lat, tee.lon, basket.lat, basket.lon)
      const distanceFt = clampHoleDistanceFeet(rawFeet)
      const bearingDeg = initialBearingDegrees(tee.lat, tee.lon, basket.lat, basket.lon)
      const teeBearing = bearingToTeeBearing(bearingDeg)
      const accuracy = combinedAccuracy(tee, basket)

      onMeasured({ distanceFt, teeBearing })
      setResultLabel(
        `Measured ${distanceFt.toLocaleString()} ft` +
          (accuracy != null ? ` · GPS accuracy ~±${accuracy} m` : ''),
      )
    } catch (err) {
      setError(
        err instanceof LocationError ? err.message : 'Could not mark basket location',
      )
    } finally {
      setBusy(null)
    }
  }

  function reset() {
    setTee(null)
    setError(null)
    setResultLabel(null)
  }

  return (
    <div className="hole-distance-measure">
      <div className="hole-distance-measure-head">
        <strong>GPS hole length</strong>
        <span className="muted small">Tee pad → basket</span>
      </div>
      <p className="muted small hole-distance-measure-copy">
        Stand on the tee and tap mark tee, then walk to the basket (or your disc at the target)
        and tap mark basket. Distance is calculated in feet from your GPS fixes.
      </p>

      <ol className="hole-distance-measure-steps">
        <li className={tee ? 'hole-distance-step-done' : busy === 'tee' ? 'hole-distance-step-active' : ''}>
          <span>Tee pad</span>
          {tee ? (
            <span className="muted small">Marked{formatAccuracy(tee.accuracyMeters)}</span>
          ) : (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy != null}
              onClick={() => void markTee()}
            >
              {busy === 'tee' ? 'Getting location…' : 'Mark tee'}
            </button>
          )}
        </li>
        <li className={busy === 'basket' ? 'hole-distance-step-active' : ''}>
          <span>Basket / target</span>
          <button
            type="button"
            className="btn-primary"
            disabled={!tee || busy != null}
            onClick={() => void markBasket()}
          >
            {busy === 'basket' ? 'Getting location…' : 'Mark basket'}
          </button>
        </li>
      </ol>

      {resultLabel && <p className="hole-distance-measure-result">{resultLabel}</p>}
      {error && <p className="hole-distance-measure-error muted small">{error}</p>}

      {(tee || resultLabel) && (
        <button type="button" className="link-button small" onClick={reset}>
          Start over
        </button>
      )}
    </div>
  )
}
