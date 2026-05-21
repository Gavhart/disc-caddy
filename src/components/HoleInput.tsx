import { Elevation, Hole, HoleDirection, WindDirection } from '../types'

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

const WIND_OPTIONS: WindDirection[] = ['None', 'Headwind', 'Tailwind']

interface Props {
  hole: Hole
  onChange: (hole: Hole) => void
  /** When true, distance/direction/elevation are locked (driven by a course-hole pick). */
  locked?: boolean
}

export function HoleInput({ hole, onChange, locked = false }: Props) {
  return (
    <section className="card">
      <h2>Hole</h2>
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
            onChange={e =>
              onChange({ ...hole, distance: Number(e.target.value) || 0 })
            }
            disabled={locked}
          />
          <span className="suffix">ft</span>
        </div>
      </div>
      <div className="field-row">
        <label htmlFor="dir">Direction</label>
        <select
          id="dir"
          value={hole.direction}
          onChange={e =>
            onChange({ ...hole, direction: e.target.value as HoleDirection })
          }
          disabled={locked}
        >
          {DIRECTION_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field-row">
        <label htmlFor="elev">Elevation</label>
        <select
          id="elev"
          value={hole.elevation}
          onChange={e =>
            onChange({ ...hole, elevation: e.target.value as Elevation })
          }
          disabled={locked}
        >
          {ELEVATION_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field-row">
        <label htmlFor="wind">Wind</label>
        <select
          id="wind"
          value={hole.windDirection}
          onChange={e =>
            onChange({ ...hole, windDirection: e.target.value as WindDirection })
          }
        >
          {WIND_OPTIONS.map(w => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </div>
      {hole.windDirection !== 'None' && (
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
              onChange={e =>
                onChange({ ...hole, windSpeed: Number(e.target.value) || 0 })
              }
            />
            <span className="suffix">mph</span>
          </div>
        </div>
      )}
    </section>
  )
}
