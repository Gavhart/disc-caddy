import { useEffect, useState } from 'react'
import { armSpeedFromMaxDistance, skillTier } from '../lib/armspeed'

/** Patch shape mirrors lib/profile.ts `PlayerPatch` but only the per-type
 *  distance fields, which is all this component needs to mutate.
 */
export interface PerTypeDistancePatch {
  putterMaxDistance?: number | null
  midrangeMaxDistance?: number | null
  fairwayMaxDistance?: number | null
}

interface Props {
  maxDistance: number
  /** Resolved value from `me` view (may be an explicit override OR derived). */
  putterMaxDistance: number
  midrangeMaxDistance: number
  fairwayMaxDistance: number
  onChange: (maxDistance: number) => void
  onPerTypeChange?: (patch: PerTypeDistancePatch) => void
}

/** Default ratios that `me` view falls back to when the user hasn't set a
 *  per-type override. Kept in sync with `004_per_type_distances.sql`.
 */
const DEFAULTS = {
  putter: 0.5,
  mid: 0.7,
  fairway: 0.85,
}

/** Min/max for a per-type distance input. Generous bounds — putters can be
 *  thrown 250+ by pros and a fairway can outdrive a "driver" in some bags. */
const DIST_MIN = 50
const DIST_MAX = 800

/** Parse user input. Empty string → null (clear override). Invalid → undefined
 *  (don't write anything; keep prior value). */
function parseDistance(raw: string): number | null | undefined {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < DIST_MIN || n > DIST_MAX) return undefined
  return Math.round(n)
}

export function PlayerSetup({
  maxDistance,
  putterMaxDistance,
  midrangeMaxDistance,
  fairwayMaxDistance,
  onChange,
  onPerTypeChange,
}: Props) {
  const armSpeed = armSpeedFromMaxDistance(maxDistance)
  const tier = skillTier(maxDistance)

  const derivedPutter = Math.round(maxDistance * DEFAULTS.putter)
  const derivedMid = Math.round(maxDistance * DEFAULTS.mid)
  const derivedFairway = Math.round(maxDistance * DEFAULTS.fairway)

  // Seed inputs only when the resolved value differs from the derivation —
  // that way blank placeholders read as "deriving from driver" rather than
  // duplicating a number the user never typed.
  const [putter, setPutter] = useState<string>('')
  const [mid, setMid] = useState<string>('')
  const [fairway, setFairway] = useState<string>('')

  useEffect(() => {
    setPutter(putterMaxDistance !== derivedPutter ? String(putterMaxDistance) : '')
    setMid(midrangeMaxDistance !== derivedMid ? String(midrangeMaxDistance) : '')
    setFairway(
      fairwayMaxDistance !== derivedFairway ? String(fairwayMaxDistance) : '',
    )
  }, [
    putterMaxDistance,
    midrangeMaxDistance,
    fairwayMaxDistance,
    derivedPutter,
    derivedMid,
    derivedFairway,
  ])

  function commit(
    field: 'putter' | 'mid' | 'fairway',
    raw: string,
    derived: number,
  ) {
    if (!onPerTypeChange) return
    const parsed = parseDistance(raw)
    if (parsed === undefined) return // invalid — leave local state, skip save
    // Treat "explicitly typed the derived default" as the same as blank, so
    // the user doesn't end up with a stored override that exactly matches
    // the derivation.
    const normalized = parsed !== null && parsed === derived ? null : parsed
    if (field === 'putter') onPerTypeChange({ putterMaxDistance: normalized })
    else if (field === 'mid') onPerTypeChange({ midrangeMaxDistance: normalized })
    else onPerTypeChange({ fairwayMaxDistance: normalized })
  }

  return (
    <section className="card">
      <h2>Player Setup</h2>
      <div className="field-row">
        <label htmlFor="maxDist">Max distance with a driver</label>
        <div className="input-group">
          <input
            id="maxDist"
            type="number"
            min={100}
            max={700}
            step={10}
            value={maxDistance}
            onChange={e => onChange(Number(e.target.value) || 0)}
          />
          <span className="suffix">ft</span>
        </div>
      </div>
      <div className="meta">
        <span className="pill">{tier}</span>
        <span className="muted">
          Estimated arm speed: <strong>{armSpeed} mph</strong>
        </span>
      </div>

      {onPerTypeChange && (
        <>
          <h3 className="settings-subheading">Distances by disc type</h3>
          <p className="muted small">
            Optional. Leave blank to derive from your driver distance — the
            recommender uses 50/70/85 % defaults for putter / mid / fairway.
          </p>
          <div className="distance-grid">
            <div className="field-row">
              <label htmlFor="ps-fairway">Fairway driver</label>
              <div className="input-group">
                <input
                  id="ps-fairway"
                  type="number"
                  min={DIST_MIN}
                  max={DIST_MAX}
                  step={5}
                  value={fairway}
                  placeholder={`${derivedFairway} (default)`}
                  onChange={e => setFairway(e.target.value)}
                  onBlur={e => commit('fairway', e.target.value, derivedFairway)}
                />
                <span className="suffix">ft</span>
              </div>
            </div>
            <div className="field-row">
              <label htmlFor="ps-mid">Midrange</label>
              <div className="input-group">
                <input
                  id="ps-mid"
                  type="number"
                  min={DIST_MIN}
                  max={DIST_MAX}
                  step={5}
                  value={mid}
                  placeholder={`${derivedMid} (default)`}
                  onChange={e => setMid(e.target.value)}
                  onBlur={e => commit('mid', e.target.value, derivedMid)}
                />
                <span className="suffix">ft</span>
              </div>
            </div>
            <div className="field-row">
              <label htmlFor="ps-putter">Putter</label>
              <div className="input-group">
                <input
                  id="ps-putter"
                  type="number"
                  min={DIST_MIN}
                  max={DIST_MAX}
                  step={5}
                  value={putter}
                  placeholder={`${derivedPutter} (default)`}
                  onChange={e => setPutter(e.target.value)}
                  onBlur={e => commit('putter', e.target.value, derivedPutter)}
                />
                <span className="suffix">ft</span>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
