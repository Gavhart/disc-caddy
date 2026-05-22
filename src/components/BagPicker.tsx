import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bag } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { FREE_TIER } from '../lib/subscription'

interface Props {
  bags: Bag[]
  activeBagId: string | null
  onSelect: (bagId: string) => void
  onCreate?: (name: string) => Promise<void>
  onRename?: (bagId: string, name: string) => Promise<void>
  /** Recommend page: dropdown only; bag CRUD lives on /bags. */
  compact?: boolean
}

export function BagPicker({
  bags,
  activeBagId,
  onSelect,
  onCreate,
  onRename,
  compact = false,
}: Props) {
  const { me } = useAuth()
  const isPro = me?.isPro ?? false
  const reachedFreeLimit = !isPro && bags.length >= FREE_TIER.maxBags

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameName, setRenameName] = useState('')

  const activeBag = bags.find(b => b.id === activeBagId) ?? null

  // Keep the rename field in sync if the active bag changes mid-edit.
  useEffect(() => {
    if (!renaming) return
    setRenameName(activeBag?.name ?? '')
  }, [activeBag?.id, renaming])

  async function handleCreate() {
    if (!name.trim() || !onCreate) return
    await onCreate(name.trim())
    setName('')
    setCreating(false)
  }

  async function handleRename() {
    if (!activeBag || !onRename) return
    const trimmed = renameName.trim()
    if (!trimmed || trimmed === activeBag.name) {
      setRenaming(false)
      return
    }
    await onRename(activeBag.id, trimmed)
    setRenaming(false)
  }

  function startRename() {
    if (!activeBag) return
    setRenameName(activeBag.name)
    setRenaming(true)
  }

  return (
    <div className="bag-picker">
      <div className="bag-picker-row">
        <label htmlFor="active-bag" className="muted small">
          Active bag
        </label>
        {renaming && activeBag && onRename ? (
          <div className="bag-picker-create">
            <input
              type="text"
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') setRenaming(false)
              }}
              autoFocus
            />
            <button onClick={handleRename} className="btn-secondary">
              Save
            </button>
            <button
              onClick={() => setRenaming(false)}
              className="link-button"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="bag-picker-select-row">
            <select
              id="active-bag"
              value={activeBagId ?? ''}
              onChange={e => onSelect(e.target.value)}
            >
              {bags.length === 0 && <option value="">— no bags yet —</option>}
              {bags.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
            {activeBag && onRename && !compact && (
              <button
                onClick={startRename}
                className="link-button"
                aria-label={`Rename ${activeBag.name}`}
              >
                Rename
              </button>
            )}
          </div>
        )}
      </div>
      {compact ? (
        <p className="muted small bag-picker-hint">
          Add or edit discs on the{' '}
          <Link to="/bags" className="link-button">
            Bags
          </Link>{' '}
          page.
        </p>
      ) : creating ? (
        <div className="bag-picker-create">
          <input
            type="text"
            placeholder="Bag name (e.g., Tournament bag)"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') setCreating(false)
            }}
            autoFocus
          />
          <button onClick={handleCreate} className="btn-secondary">
            Create
          </button>
          <button onClick={() => setCreating(false)} className="link-button">
            Cancel
          </button>
        </div>
      ) : reachedFreeLimit ? (
        <div className="paywall-inline">
          <span className="muted small">
            Free plan: 1 bag. Upgrade for unlimited bags.
          </span>
          <Link to="/upgrade" className="btn-secondary">
            Upgrade
          </Link>
        </div>
      ) : (
        !renaming &&
        onCreate && (
          <button onClick={() => setCreating(true)} className="link-button">
            + New bag
          </button>
        )
      )}
    </div>
  )
}
