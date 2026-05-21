import { BagDisc, Plastic, Weight, Wear } from '../types'
import { DiscPhotoUploader } from './DiscPhotoUploader'
import { DiscSelect } from './DiscSelect'

const PLASTIC_OPTIONS: Plastic[] = ['Premium', 'Base', 'Glow']
const WEIGHT_OPTIONS: Weight[] = ['Max', 'Standard', 'Light']
const WEAR_OPTIONS: Wear[] = ['New', 'Broken In', 'Beat In']

interface Props {
  discs: BagDisc[]
  busy?: boolean
  onAdd: () => Promise<void>
  onUpdate: (id: string, patch: Partial<BagDisc>) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onPhotoChange: (id: string, newPath: string | null) => void
}

export function MyBag({
  discs,
  busy,
  onAdd,
  onUpdate,
  onRemove,
  onPhotoChange,
}: Props) {
  return (
    <section className="card">
      <div className="card-header">
        <h2>My Bag</h2>
        <button className="btn-secondary" onClick={onAdd} disabled={busy}>
          + Add disc
        </button>
      </div>
      {discs.length === 0 && (
        <p className="muted">
          No discs in this bag yet. Add some to start getting recommendations.
        </p>
      )}
      <ul className="bag-list">
        {discs.map(d => (
          <li key={d.id} className="bag-row">
            <div className="bag-row-top">
              <DiscPhotoUploader
                discId={d.id}
                photoPath={d.photoPath}
                onChange={newPath => onPhotoChange(d.id, newPath)}
              />
              <div className="bag-disc-select">
                <DiscSelect
                  value={d.discName}
                  onChange={name => onUpdate(d.id, { discName: name })}
                />
              </div>
            </div>
            <div className="bag-mods">
              <select
                value={d.plastic}
                onChange={e =>
                  onUpdate(d.id, { plastic: e.target.value as Plastic })
                }
                aria-label="Plastic"
              >
                {PLASTIC_OPTIONS.map(o => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <select
                value={d.weight}
                onChange={e =>
                  onUpdate(d.id, { weight: e.target.value as Weight })
                }
                aria-label="Weight"
              >
                {WEIGHT_OPTIONS.map(o => (
                  <option key={o} value={o}>
                    {o} wt
                  </option>
                ))}
              </select>
              <select
                value={d.wear}
                onChange={e => onUpdate(d.id, { wear: e.target.value as Wear })}
                aria-label="Wear"
              >
                {WEAR_OPTIONS.map(o => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onRemove(d.id)}
                aria-label="Remove disc"
                title="Remove disc"
                className="btn-icon"
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
