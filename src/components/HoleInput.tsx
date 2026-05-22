import { useState } from 'react'
import { fetchLiveWind } from '../lib/weather'
import { ProGate } from './ProGate'
import {
  Elevation,
  Hole,
  HoleDirection,
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

/**
 * Compass-rose layout for the wind picker. Positions correspond to where the
 * wind is coming *from*, mirroring how a player looks at the tee shot
 * (basket is "up"). `null` cells render an empty grid slot so the rose keeps
 * its 3×3 shape.
 */
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

interface Props {
  hole: Hole
  onChange: (hole: Hole) => void
  /** When true, layout fields are locked (driven by a course-hole pick). */
  locked?: boolean
  /** Pro: fetch live wind when course coordinates are available. */
  courseLat?: number | null
  courseLon?: number | null
  isPro?: boolean
}

/**
 * Single-select chip group. Renders the options as buttons with
 * `aria-pressed` toggled. Wraps to multiple lines on narrow screens; pairs
 * naturally with `.chip-row` styling.
 */
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
  isPro = false,
}: Props) {
  const [windLoading, setWindLoading] = useState(false)
  const [windError, setWindError] = useState<string | null>(null)
  const [windLabel, setWindLabel] = useState<string | null>(null)
  const [showProGate, setShowProGate] = useState(false)

  const hasCoords =
    courseLat != null &&
    courseLon != null &&
    Number.isFinite(courseLat) &&
    Number.isFinite(courseLon)
  // Tree-layout only matters when there are actually trees in play. When the
  // user flips coverage back to "open" we proactively clear the layout so
  // stale "back half" picks don't survive a coverage reset.
  const showTreeLayout = hole.treeCoverage !== 'open'

  function setHole<K extends keyof Hole>(key: K, value: Hole[K]) {
    onChange({ ...hole, [key]: value })
  }

  function setTreeCoverage(value: TreeCoverage) {
    onChange({
      ...hole,
      treeCoverage: value,
      // Reset to 'none' when we go back to open fairway; default to
      // 'throughout' when leaving open (so the chip group has a sensible
      // initial selection); otherwise preserve the user's existing pick.
      treeLayout:
        value === 'open'
          ? 'none'
          : hole.treeLayout === 'none'
            ? 'throughout'
            : hole.treeLayout,
    })
  }

  async function handleFetchLiveWind() {
    if (!hasCoords) return
    if (!isPro) {
      setShowProGate(true)
      return
    }
    setWindLoading(true)
    setWindError(null)
    setShowProGate(false)
    try {
      const live = await fetchLiveWind(courseLat!, courseLon!)
      onChange({
        ...hole,
        windDirection: live.windDirection,
        windSpeed: live.windSpeed,
      })
      setWindLabel(live.label)
    } catch (err) {
      setWindError(err instanceof Error ? err.message : 'Could not fetch wind')
      setWindLabel(null)
    } finally {
      setWindLoading(false)
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
        <span className="chip-group-label">Wind</span>
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
                onClick={() => {
                  // Clearing the wind also zeros the speed so the saved state
                  // stays consistent ("none" + 0 mph).
                  if (cell.value === 'none') {
                    onChange({ ...hole, windDirection: 'none', windSpeed: 0 })
                  } else {
                    setHole('windDirection', cell.value)
                  }
                }}
              >
                <span className="wind-cell-arrow">{cell.label}</span>
                <span className="wind-cell-sub">{cell.sub}</span>
              </button>
            ) : (
              <span key={`empty-${i}`} className="wind-cell wind-cell-empty" />
            ),
          )}
        </div>

        {hasCoords && (
          <div className="live-wind-row">
            <button
              type="button"
              className="btn-secondary live-wind-btn"
              onClick={handleFetchLiveWind}
              disabled={windLoading}
            >
              {windLoading ? 'Fetching wind…' : 'Fetch live wind'}
            </button>
            {windLabel && (
              <span className="muted small live-wind-label">{windLabel}</span>
            )}
            {windError && (
              <span className="form-error small live-wind-error">{windError}</span>
            )}
          </div>
        )}
        {showProGate && !isPro && (
          <ProGate feature="Live wind">
            {' '}Auto-fill wind from Open-Meteo at the course location.
          </ProGate>
        )}
        {!hasCoords && (
          <p className="muted small live-wind-hint">
            Pick a course with location data to enable live wind (Pro).
          </p>
        )}
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
              onChange={e => setHole('windSpeed', Number(e.target.value) || 0)}
            />
            <span className="suffix">mph</span>
          </div>
        </div>
      )}
    </section>
  )
}
