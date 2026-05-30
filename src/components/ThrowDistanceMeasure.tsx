import { useState } from 'react'
import { clampThrowDistanceFeet, haversineFeet } from '../lib/geo'
import { getPreciseLocation, LocationError, PreciseLocation } from '../lib/weather'

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

export interface ThrowMeasureResult {
  distanceFt: number
  landingLat?: number
  landingLon?: number
}

export function ThrowDistanceMeasure({
  onMeasured,
  title = 'GPS throw distance',
  subtitle = 'Release → disc',
  copy = 'Stand where you threw from and tap mark release, then walk to your disc (or target) and tap mark landing.',
  startLabel = 'Release',
  endLabel = 'Landing / target',
  markStartLabel = 'Mark release',
  markEndLabel = 'Mark landing',
}: {
  onMeasured: (result: ThrowMeasureResult | number) => void
  title?: string
  subtitle?: string
  copy?: string
  startLabel?: string
  endLabel?: string
  markStartLabel?: string
  markEndLabel?: string
}) {
  const [release, setRelease] = useState<PreciseLocation | null>(null)
  const [busy, setBusy] = useState<'release' | 'landing' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resultLabel, setResultLabel] = useState<string | null>(null)

  async function markRelease() {
    setBusy('release')
    setError(null)
    setResultLabel(null)
    try {
      const fix = await getPreciseLocation()
      setRelease(fix)
    } catch (err) {
      setError(err instanceof LocationError ? err.message : 'Could not mark release point')
    } finally {
      setBusy(null)
    }
  }

  async function markLanding() {
    if (!release) return
    setBusy('landing')
    setError(null)
    try {
      const landing = await getPreciseLocation()
      const rawFeet = haversineFeet(release.lat, release.lon, landing.lat, landing.lon)
      const distanceFt = clampThrowDistanceFeet(rawFeet)
      const accuracy = combinedAccuracy(release, landing)

      onMeasured({
        distanceFt,
        landingLat: landing.lat,
        landingLon: landing.lon,
      })
      setResultLabel(
        `Measured ${distanceFt.toLocaleString()} ft` +
          (accuracy != null ? ` · GPS accuracy ~±${accuracy} m` : ''),
      )
    } catch (err) {
      setError(
        err instanceof LocationError ? err.message : 'Could not mark landing point',
      )
    } finally {
      setBusy(null)
    }
  }

  function reset() {
    setRelease(null)
    setError(null)
    setResultLabel(null)
  }

  return (
    <div className="hole-distance-measure">
      <div className="hole-distance-measure-head">
        <strong>{title}</strong>
        <span className="muted small">{subtitle}</span>
      </div>
      <p className="muted small hole-distance-measure-copy">{copy}</p>

      <ol className="hole-distance-measure-steps">
        <li
          className={
            release
              ? 'hole-distance-step-done'
              : busy === 'release'
                ? 'hole-distance-step-active'
                : ''
          }
        >
          <span>{startLabel}</span>
          {release ? (
            <span className="muted small">Marked{formatAccuracy(release.accuracyMeters)}</span>
          ) : (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy != null}
              onClick={() => void markRelease()}
            >
              {busy === 'release' ? 'Getting location…' : markStartLabel}
            </button>
          )}
        </li>
        <li className={busy === 'landing' ? 'hole-distance-step-active' : ''}>
          <span>{endLabel}</span>
          <button
            type="button"
            className="btn-primary"
            disabled={!release || busy != null}
            onClick={() => void markLanding()}
          >
            {busy === 'landing' ? 'Getting location…' : markEndLabel}
          </button>
        </li>
      </ol>

      {resultLabel && <p className="hole-distance-measure-result">{resultLabel}</p>}
      {error && <p className="hole-distance-measure-error muted small">{error}</p>}

      {(release || resultLabel) && (
        <button type="button" className="link-button small" onClick={reset}>
          Start over
        </button>
      )}
    </div>
  )
}
