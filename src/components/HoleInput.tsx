import { useState } from 'react'
import { fetchLiveWind, getUserLocation } from '../lib/weather'
import {
  Elevation,
  Hole,
  HoleDirection,
  TeeBearing,
  TEE_BEARING_DEG,
  TEE_BEARING_OPTIONS,
  Terrain,
  TreeCoverage,
  TreeLayout,
  WindDirection,
} from '../types'

const DIRECTION_OPTIONS: { value: HoleDirection; label: string }[] = [
  { value: 'hard_left', label: 'Hard left' },
  { value: 'dogleg_left', label: 'Dogleg left' },
  { value: 'straight', label: 'Straight' },
  { value: 'dogleg_right', label: 'Dogleg right' },
  { value: 'hard_right', label: 'Hard right' },
]

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

const TREE_COVERAGE_OPTIONS: { value: TreeCoverage; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'light', label: 'Light' },
  { value: 'wooded', label: 'Wooded' },
  { value: 'heavily_wooded', label: 'Heavy' },
]

const TREE_LAYOUT_OPTIONS: { value: TreeLayout; label: string }[] = [
  { value: 'throughout', label: 'Throughout' },
  { value: 'front_half', label: 'Front half' },
  { value: 'back_half', label: 'Back half' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'canopy', label: 'Canopy' },
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
  /** When true, layout fields are locked (driven by a course-hole pick). */
  locked?: boolean
  /** Fallback weather coordinates when GPS is unavailable. */
  courseLat?: number | null
  courseLon?: number | null
  /** When set, tee bearing changes are saved back to this course hole. */
  onPersistTeeBearing?: (bearing: TeeBearing) => void | Promise<void>
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
  locked = false,
  courseLat = null,
  courseLon = null,
  onPersistTeeBearing,
}: Props) {
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
      treeLayout:
        value === 'open'
          ? 'none'
          : hole.treeLayout === 'none'
            ? 'throughout'
            : hole.treeLayout,
    })
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
    <section className="card">
      <h2>What hole are you playing?</h2>

      <div className="field-row">
        <label htmlFor="dist">Distance</label>
        <div className="input-group">
          <input
            id="dist"
            type="number"
            min={50}
            max={800}
            step={10}
            value={hole.distance}
            onChange={e => setHole('distance', Number(e.target.value) || 0)}
            disabled={locked}
          />
          <span className="suffix">ft</span>
        </div>
      </div>

      <ChipGroup
        label="Direction"
        value={hole.direction}
        options={DIRECTION_OPTIONS}
        onChange={v => setHole('direction', v)}
        disabled={locked}
      />

      <ChipGroup
        label="Net elevation (tee → basket)"
        value={hole.elevation}
        options={ELEVATION_OPTIONS}
        onChange={v => setHole('elevation', v)}
        disabled={locked}
      />

      <ChipGroup
        label="Terrain"
        value={hole.terrain}
        options={TERRAIN_OPTIONS}
        onChange={v => setHole('terrain', v)}
        disabled={locked}
      />

      <ChipGroup
        label="Trees"
        value={hole.treeCoverage}
        options={TREE_COVERAGE_OPTIONS}
        onChange={setTreeCoverage}
        disabled={locked}
      />

      {showTreeLayout && (
        <ChipGroup
          label="Tree layout"
          value={hole.treeLayout}
          options={TREE_LAYOUT_OPTIONS}
          onChange={v => setHole('treeLayout', v)}
          disabled={locked}
        />
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
