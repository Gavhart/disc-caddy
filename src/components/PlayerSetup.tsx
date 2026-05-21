import { armSpeedFromMaxDistance, skillTier } from '../lib/armspeed'

interface Props {
  maxDistance: number
  onChange: (maxDistance: number) => void
}

export function PlayerSetup({ maxDistance, onChange }: Props) {
  const armSpeed = armSpeedFromMaxDistance(maxDistance)
  const tier = skillTier(maxDistance)

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
    </section>
  )
}
