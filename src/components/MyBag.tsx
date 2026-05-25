import { useEffect, useState } from 'react'
import {
  BagDisc,
  Plastic,
  WEIGHT_GRAMS_DEFAULT,
  WEIGHT_GRAMS_MAX,
  WEIGHT_GRAMS_MIN,
  Wear,
} from '../types'
import { clampWeightGrams } from '../lib/modifiers'
import { DiscPhotoUploader } from './DiscPhotoUploader'
import { DiscSelect } from './DiscSelect'

const PLASTIC_OPTIONS: Plastic[] = ['Premium', 'Base', 'Glow']
const WEAR_OPTIONS: Wear[] = ['New', 'Broken In', 'Beat In']

interface Props {
  /** Optional heading; defaults to "My Bag". */
  title?: string
  discs: BagDisc[]
  busy?: boolean
  onAdd: () => Promise<void>
  onUpdate: (id: string, patch: Partial<BagDisc>) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onPhotoChange: (id: string, newPath: string | null) => void
}

export function MyBag({
  title = 'My Bag',
  discs,
  busy,
  onAdd,
  onUpdate,
  onRemove,
  onPhotoChange,
}: Props) {
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (discs.length === 0) setEditing(false)
  }, [discs.length])

  useEffect(() => {
    setEditing(false)
  }, [title])

  return (
    <section className={`card${editing ? ' bag-editing' : ''}`}>
      <div className="card-header">
        <h2>{title}</h2>
        <div className="card-header-actions">
          {discs.length > 0 && (
            <button
              type="button"
              className={editing ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setEditing(v => !v)}
            >
              {editing ? 'Done' : 'Edit bag'}
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={onAdd}
            disabled={busy}
          >
            + Add disc
          </button>
        </div>
      </div>
      {editing && (
        <p className="muted small bag-edit-hint">
          Tap × on a disc to remove it from this bag.
        </p>
      )}
      {discs.length === 0 && (
        <p className="muted">
          No discs in this bag yet. Add some to start getting recommendations.
        </p>
      )}
      <ul className="bag-list">
        {discs.map(d => (
          <li key={d.id} className={`bag-row${editing ? ' bag-row-editing' : ''}`}>
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
              <label className="bag-weight-field">
                <input
                  type="number"
                  inputMode="numeric"
                  min={WEIGHT_GRAMS_MIN}
                  max={WEIGHT_GRAMS_MAX}
                  step={1}
                  value={d.weightGrams}
                  onChange={e => {
                    const v = e.target.valueAsNumber
                    if (Number.isFinite(v)) {
                      onUpdate(d.id, { weightGrams: v })
                    }
                  }}
                  onBlur={e => {
                    const v = e.target.valueAsNumber
                    const clamped = Number.isFinite(v)
                      ? clampWeightGrams(v)
                      : WEIGHT_GRAMS_DEFAULT
                    if (clamped !== d.weightGrams) {
                      onUpdate(d.id, { weightGrams: clamped })
                    }
                  }}
                  aria-label="Weight in grams"
                />
                <span className="bag-weight-suffix">g</span>
              </label>
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
              {editing && (
                <button
                  type="button"
                  onClick={() => onRemove(d.id)}
                  aria-label="Remove disc"
                  title="Remove disc"
                  className="btn-icon btn-icon-danger"
                >
                  ×
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
