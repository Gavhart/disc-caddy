import { useEffect, useState } from 'react'
import { summarizeHoleLayout } from '../lib/holeLabels'
import {
  DIRECTION_OPTIONS,
  MANDO_OPTIONS,
  nextTreeLayoutForCoverage,
  TREE_COVERAGE_OPTIONS,
  TREE_LAYOUT_OPTIONS,
} from '../lib/holeLayoutOptions'
import { clampHoleDistanceFeet } from '../lib/geo'
import { fetchLiveWind, getUserLocation } from '../lib/weather'
import { HoleDistanceMeasure } from './HoleDistanceMeasure'
import { LieLayoutInput, LieLayoutValue } from './LieLayoutInput'
import {
  Elevation,
  Hole,
  TeeBearing,
  TEE_BEARING_DEG,
  TEE_BEARING_OPTIONS,
  Terrain,
  TreeCoverage,
  WindDirection,
} from '../types'

const DIRECTION_OPTIONS_LOCAL = DIRECTION_OPTIONS

const ELEVATION_OPTIONS: { value: Elevation; label: string }[] = [
  { value: 'uphill', label: 'Uphill' },
  { value: 'flat', label: 'Flat' },
  { value: 'downhill', label: 'Downhill' },
]

const TERRAIN_OPTIONS: { value: Terrain; label: string }[] = [
  { value: 'flat', label: 'Flat' },
  { value: 'rolling', label: 'Rolling' },
  { value: 'hilly', label: 'Hilly' },
  { value: 'mountainous', label: 'Mountainous' },
]

const WIND_ROSE: ({ value: WindDirection; label: string; sub: string } | null)[] = [
  { value: 'head_from_left',  label: '↘',  sub: 'Head/L'  },
  { value: 'headwind',         label: '↓',  sub: 'Head'    },
  { value: 'head_from_right', label: '↙',  sub: 'Head/R'  },
  { value: 'from_left',        label: '→',  sub: 'From L'  },
  { value: 'none',             label: '·',  sub: 'No wind' },
  { value: 'from_right',       label: '←',  sub: 'From R'  },
  { value: 'tail_from_left',  label: '↗',  sub: 'Tail/L'  },
  { value: 'tailwind',         label: '↑',  sub: 'Tail'    },
  { value: 'tail_from_right', label: '↖',  sub: 'Tail/R'  },
]

type WindSource = 'live' | 'manual'

interface Props {
  hole: Hole
  onChange: (hole: Hole) => void
  /** Course hole drives layout; custom hole lets you edit everything. */
  source?: 'course' | 'custom'
  courseLabel?: string
  /** @deprecated use source === 'course' */
  locked?: boolean
  /** Fallback weather coordinates when GPS is unavailable. */
  courseLat?: number | null
  courseLon?: number | null
  /** When set, tee bearing changes are saved back to this course hole. */
  onPersistTeeBearing?: (bearing: TeeBearing) => void | Promise<void>
  /** Session-only layout tweaks on course holes (mandos, updated tree line). */
  lieLayout?: Partial<LieLayoutValue>
  onLieLayoutChange?: (patch: Partial<LieLayoutValue>) => void
}

function ChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <div className="chip-group">
      <span className="chip-group-label">{label}</span>
      <div className="chip-row">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            className={`chip ${value === o.value ? 'chip-on' : ''}`}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            disabled={disabled}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function HoleInput({
  hole,
  onChange,
  source = 'custom',
  courseLabel,
  locked = false,
  courseLat = null,
  courseLon = null,
  onPersistTeeBearing,
  lieLayout = {},
  onLieLayoutChange,
}: Props) {
  const isCourseHole = source === 'course' || locked
  const [windLoading, setWindLoading] = useState(false)
  const [windError, setWindError] = useState<string | null>(null)
  const [windLabel, setWindLabel] = useState<string | null>(null)
  const [windSource, setWindSource] = useState<WindSource | null>(null)
  const [lastWindCoords, setLastWindCoords] = useState<{
    lat: number
    lon: number
  } | null>(null)

  const throwBearingDeg = TEE_BEARING_DEG[hole.teeBearing ?? 'north']

  const hasCourseCoords =
    courseLat != null &&
    courseLon != null &&
    Number.isFinite(courseLat) &&
    Number.isFinite(courseLon)

  const showTreeLayout = hole.treeCoverage !== 'open'

  const [distanceText, setDistanceText] = useState(() => String(hole.distance))

  useEffect(() => {
    setDistanceText(String(hole.distance))
  }, [hole.distance])

  function commitDistance(raw: string) {
    const trimmed = raw.trim()
    if (trimmed === '') {
      setDistanceText(String(hole.distance))
      return
    }
    const n = Math.round(Number(trimmed))
    if (Number.isNaN(n)) {
      setDistanceText(String(hole.distance))
      return
    }
    const clamped = clampHoleDistanceFeet(n)
    setDistanceText(String(clamped))
    if (clamped !== hole.distance) {
      setHole('distance', clamped)
    }
  }

  function applyGpsMeasurement(result: { distanceFt: number; teeBearing: TeeBearing }) {
    setDistanceText(String(result.distanceFt))
    onChange({ ...hole, distance: result.distanceFt, teeBearing: result.teeBearing })
    void onPersistTeeBearing?.(result.teeBearing)
  }

  function handleDistanceChange(raw: string) {
    if (!/^\d*$/.test(raw)) return
    setDistanceText(raw)
    if (raw === '') return
    const n = Number(raw)
    if (Number.isNaN(n)) return
    // Commit live once the value is a plausible full distance (avoids "5" → 5 ft).
    if (n >= 100 && n <= 1500) {
      setHole('distance', clampHoleDistanceFeet(n))
    }
  }

  function setHole<K extends keyof Hole>(key: K, value: Hole[K]) {
    onChange({ ...hole, [key]: value })
  }

  function markManualWind() {
    setWindSource('manual')
    setWindLabel(null)
    setWindError(null)
  }

  function applyLiveWind(
    live: { windDirection: WindDirection; windSpeed: number; label: string },
    labelSuffix = '',
    base: Hole = hole,
  ) {
    onChange({
      ...base,
      windDirection: live.windDirection,
      windSpeed: live.windSpeed,
    })
    setWindSource('live')
    setWindLabel(labelSuffix ? `${live.label} ${labelSuffix}` : live.label)
    setWindError(null)
  }

  function setTreeCoverage(value: TreeCoverage) {
    onChange({
      ...hole,
      treeCoverage: value,
      treeLayout: nextTreeLayoutForCoverage(value, hole.treeLayout),
    })
  }

  const mergedLieLayout: LieLayoutValue = {
    direction: lieLayout.direction ?? hole.direction,
    treeCoverage: lieLayout.treeCoverage ?? hole.treeCoverage,
    treeLayout: lieLayout.treeLayout ?? hole.treeLayout,
    mando: lieLayout.mando ?? hole.mando ?? 'none',
  }

  const hasLieOverride =
    Object.keys(lieLayout).length > 0 &&
    (lieLayout.direction != null ||
      lieLayout.treeCoverage != null ||
      lieLayout.treeLayout != null ||
      lieLayout.mando != null)

  function clearLieLayout() {
    onLieLayoutChange?.({})
  }

  async function applyWindFromCoords(
    lat: number,
    lon: number,
    labelSuffix = '',
  ) {
    const live = await fetchLiveWind(lat, lon, throwBearingDeg)
    applyLiveWind(live, labelSuffix)
    setLastWindCoords({ lat, lon })
  }

  async function handleUseMyLocation() {
    setWindLoading(true)
    setWindError(null)
    try {
      const { lat, lon } = await getUserLocation()
      await applyWindFromCoords(lat, lon)
    } catch (err) {
      setWindError(err instanceof Error ? err.message : 'Could not fetch wind')
      setWindLabel(null)
    } finally {
      setWindLoading(false)
    }
  }

  async function handleUseCourseLocation() {
    if (!hasCourseCoords) return
    setWindLoading(true)
    setWindError(null)
    try {
      await applyWindFromCoords(courseLat!, courseLon!, '(course)')
    } catch (err) {
      setWindError(err instanceof Error ? err.message : 'Could not fetch wind')
      setWindLabel(null)
    } finally {
      setWindLoading(false)
    }
  }

  async function setTeeBearing(bearing: TeeBearing) {
    const nextHole = { ...hole, teeBearing: bearing }
    onChange(nextHole)
    onPersistTeeBearing?.(bearing)
    if (windSource !== 'live' || !lastWindCoords) return
    setWindLoading(true)
    setWindError(null)
    try {
      const live = await fetchLiveWind(
        lastWindCoords.lat,
        lastWindCoords.lon,
        TEE_BEARING_DEG[bearing],
      )
      applyLiveWind(live, '', nextHole)
    } catch (err) {
      setWindError(err instanceof Error ? err.message : 'Could not update wind')
    } finally {
      setWindLoading(false)
    }
  }

  function handleWindRosePick(cell: (typeof WIND_ROSE)[number]) {
    if (!cell) return
    markManualWind()
    if (cell.value === 'none') {
      onChange({ ...hole, windDirection: 'none', windSpeed: 0 })
    } else {
      onChange({ ...hole, windDirection: cell.value })
    }
  }

  return (
    <section className={'card hole-input' + (isCourseHole ? ' hole-input-course' : ' hole-input-custom')}>
      {isCourseHole ? (
        <>
          <h2>Wind for this hole</h2>
          <p className="muted small hole-input-intro">
            {courseLabel ? (
              <>
                Layout for <strong>{courseLabel}</strong> comes from the course stepper
                above.
              </>
            ) : (
              <>Layout comes from your selected course hole.</>
            )}{' '}
            Recommendations use that layout — set wind and tee direction here.
          </p>
          <div className="hole-layout-summary">
            <span className="hole-layout-summary-label">From course</span>
            <p>{summarizeHoleLayout(hole)}</p>
          </div>
          <div className="lie-layout-section">
            <div className="lie-layout-section-head">
              <h3>Fine-tune layout</h3>
              {hasLieOverride && onLieLayoutChange && (
                <button type="button" className="link-button small" onClick={clearLieLayout}>
                  Reset to course
                </button>
              )}
            </div>
            <p className="muted small">
              Override trees or mandos for this round only — does not change the saved course
              hole.
            </p>
            {onLieLayoutChange ? (
              <LieLayoutInput
                value={mergedLieLayout}
                onChange={patch => onLieLayoutChange(patch)}
              />
            ) : (
              <p className="muted small">Sign in to adjust layout for this hole.</p>
            )}
          </div>
          <HoleDistanceMeasure onMeasured={applyGpsMeasurement} />
        </>
      ) : (
        <>
          <h2>Custom hole</h2>
          <p className="muted small hole-input-intro">
            Enter any hole manually when you&apos;re not stepping through a saved course.
            Pick a course above for full-round tracking and live scoring.
          </p>
          <div className="field-row">
            <label htmlFor="dist">Distance</label>
            <div className="input-group">
              <input
                id="dist"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={distanceText}
                onChange={e => handleDistanceChange(e.target.value)}
                onBlur={() => commitDistance(distanceText)}
                aria-describedby="dist-hint"
              />
              <span className="suffix">ft</span>
            </div>
            <p id="dist-hint" className="muted small hole-distance-hint">
              50–1,500 ft. Clear the field to retype, or measure tee → basket with GPS below.
            </p>
          </div>

          <HoleDistanceMeasure onMeasured={applyGpsMeasurement} />

          <ChipGroup
            label="Direction"
            value={hole.direction}
            options={DIRECTION_OPTIONS_LOCAL}
            onChange={v => setHole('direction', v)}
          />

          <ChipGroup
            label="Net elevation (tee → basket)"
            value={hole.elevation}
            options={ELEVATION_OPTIONS}
            onChange={v => setHole('elevation', v)}
          />

          <ChipGroup
            label="Terrain"
            value={hole.terrain}
            options={TERRAIN_OPTIONS}
            onChange={v => setHole('terrain', v)}
          />

          <ChipGroup
            label="Trees"
            value={hole.treeCoverage}
            options={TREE_COVERAGE_OPTIONS}
            onChange={setTreeCoverage}
          />

          {showTreeLayout && (
            <ChipGroup
              label="Tree layout"
              value={hole.treeLayout}
              options={TREE_LAYOUT_OPTIONS}
              onChange={v => setHole('treeLayout', v)}
            />
          )}

          <ChipGroup
            label="Mando"
            value={hole.mando ?? 'none'}
            options={MANDO_OPTIONS}
            onChange={v => setHole('mando', v)}
          />
        </>
      )}

      <div className="wind-section">
        <ChipGroup
          label="Tee faces (toward basket)"
          value={hole.teeBearing ?? 'north'}
          options={TEE_BEARING_OPTIONS}
          onChange={v => void setTeeBearing(v)}
        />
        <p className="muted small wind-hint">
          Pick which way you&apos;re throwing so live weather maps to head/tail
          wind correctly. Then tap <strong>Use my location</strong> — override
          on the rose if it feels different on the tee.
        </p>

        <div className="live-wind-row">
          <button
            type="button"
            className="btn-primary live-wind-btn"
            onClick={handleUseMyLocation}
            disabled={windLoading}
          >
            {windLoading ? 'Fetching wind…' : 'Use my location'}
          </button>
          {hasCourseCoords && (
            <button
              type="button"
              className="btn-secondary live-wind-btn"
              onClick={handleUseCourseLocation}
              disabled={windLoading}
            >
              Course weather
            </button>
          )}
        </div>

        {windSource === 'live' && windLabel && (
          <div className="wind-status wind-status-live">
            <span className="pill small">Live weather</span>
            <span className="muted small">{windLabel}</span>
          </div>
        )}
        {windSource === 'manual' && (
          <div className="wind-status wind-status-manual">
            <span className="pill small">Custom wind</span>
            <span className="muted small">
              You overrode live weather — recommendations use your pick below.
            </span>
          </div>
        )}
        {windError && (
          <span className="form-error small live-wind-error">{windError}</span>
        )}

        <span className="chip-group-label">Wind direction</span>
        <p className="muted small wind-hint">
          Tap where the wind is coming <em>from</em>. Center = no wind.
        </p>

        <div className="wind-rose" role="radiogroup" aria-label="Wind direction">
          {WIND_ROSE.map((cell, i) =>
            cell ? (
              <button
                key={cell.value}
                type="button"
                role="radio"
                aria-checked={hole.windDirection === cell.value}
                aria-label={cell.sub}
                className={`wind-cell ${
                  hole.windDirection === cell.value ? 'wind-cell-on' : ''
                } ${cell.value === 'none' ? 'wind-cell-none' : ''}`}
                onClick={() => handleWindRosePick(cell)}
              >
                <span className="wind-cell-arrow">{cell.label}</span>
                <span className="wind-cell-sub">{cell.sub}</span>
              </button>
            ) : (
              <span key={`empty-${i}`} className="wind-cell wind-cell-empty" />
            ),
          )}
        </div>
      </div>
      {hole.windDirection !== 'none' && (
        <div className="field-row">
          <label htmlFor="windSpeed">Wind speed</label>
          <div className="input-group">
            <input
              id="windSpeed"
              type="number"
              min={0}
              max={50}
              step={1}
              value={hole.windSpeed}
              onChange={e => {
                markManualWind()
                setHole('windSpeed', Number(e.target.value) || 0)
              }}
            />
            <span className="suffix">mph</span>
          </div>
        </div>
      )}
    </section>
  )
}
