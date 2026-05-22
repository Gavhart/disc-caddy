import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { MyBag } from '../components/MyBag'
import {
  addDiscToBag,
  createBag,
  deleteBag,
  listBags,
  listDiscsInBag,
  removeDiscFromBag,
  renameBag,
  setDefaultBag,
  updateBagDisc,
} from '../lib/bags'
import { FREE_TIER } from '../lib/subscription'
import { Bag, BagDisc } from '../types'

export function BagsListPage() {
  const { me } = useAuth()
  const isPro = me?.isPro ?? false
  const [bags, setBags] = useState<Bag[]>([])
  const [selectedBagId, setSelectedBagId] = useState<string | null>(null)
  const [discs, setDiscs] = useState<BagDisc[]>([])
  const [discBusy, setDiscBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    listBags()
      .then(list => {
        setBags(list)
        if (list.length === 0) return
        const def = list.find(b => b.isDefault) ?? list[0]
        setSelectedBagId(prev =>
          prev && list.some(b => b.id === prev) ? prev : def.id,
        )
      })
      .catch(err => setError(err.message))
  }, [])

  useEffect(() => {
    if (!selectedBagId) {
      setDiscs([])
      return
    }
    listDiscsInBag(selectedBagId)
      .then(setDiscs)
      .catch(err => setError(err instanceof Error ? err.message : 'Load failed'))
  }, [selectedBagId])

  const reachedFreeLimit = !isPro && bags.length >= FREE_TIER.maxBags
  const selectedBag = bags.find(b => b.id === selectedBagId) ?? null

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return
    if (reachedFreeLimit) return
    setBusy(true)
    try {
      const created = await createBag(newName.trim())
      setBags(prev => [...prev, created])
      setSelectedBagId(created.id)
      setNewName('')
      setCreating(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }, [newName, reachedFreeLimit])

  const handleRename = useCallback(async (id: string) => {
    if (!editName.trim()) return
    try {
      await renameBag(id, editName.trim())
      setBags(prev =>
        prev.map(b => (b.id === id ? { ...b, name: editName.trim() } : b)),
      )
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed')
    }
  }, [editName])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this bag and all its discs?')) return
    try {
      await deleteBag(id)
      setBags(prev => {
        const next = prev.filter(b => b.id !== id)
        if (selectedBagId === id) {
          const fallback = next.find(b => b.isDefault) ?? next[0] ?? null
          setSelectedBagId(fallback?.id ?? null)
        }
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }, [selectedBagId])

  const handleSetDefault = useCallback(async (id: string) => {
    try {
      await setDefaultBag(id)
      setBags(prev => prev.map(b => ({ ...b, isDefault: b.id === id })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    }
  }, [])

  const handleAddDisc = useCallback(async () => {
    if (!selectedBagId) return
    setDiscBusy(true)
    try {
      const created = await addDiscToBag(selectedBagId, {
        discName: '',
        plastic: 'Premium',
        weight: 'Standard',
        wear: 'New',
        position: discs.length,
      })
      setDiscs(prev => [...prev, created])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add disc failed')
    } finally {
      setDiscBusy(false)
    }
  }, [selectedBagId, discs.length])

  const handleUpdateDisc = useCallback(
    async (id: string, patch: Partial<BagDisc>) => {
      setDiscs(prev => prev.map(d => (d.id === id ? { ...d, ...patch } : d)))
      try {
        await updateBagDisc(id, patch)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed')
      }
    },
    [],
  )

  const handleRemoveDisc = useCallback(async (id: string) => {
    setDiscs(prev => prev.filter(d => d.id !== id))
    try {
      await removeDiscFromBag(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed')
    }
  }, [])

  const handlePhotoChange = useCallback((id: string, newPath: string | null) => {
    setDiscs(prev =>
      prev.map(d => (d.id === id ? { ...d, photoPath: newPath } : d)),
    )
  }, [])

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h2>Your Bags</h2>
          {!creating && !reachedFreeLimit && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setCreating(true)}
              disabled={busy}
            >
              + New bag
            </button>
          )}
        </div>

        <p className="muted small">
          Pick a bag to edit its discs below. The default bag loads first on the{' '}
          <Link to="/" className="link-button">
            Recommend
          </Link>{' '}
          page.
        </p>

        {error && <div className="form-error">{error}</div>}

        {creating && (
          <div className="bag-picker-create">
            <input
              type="text"
              placeholder="Bag name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCreate}
              disabled={busy}
            >
              Create
            </button>
            <button
              type="button"
              className="link-button"
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
          </div>
        )}

        {reachedFreeLimit && (
          <div className="paywall-inline">
            <div>
              <strong>Free plan: 1 bag.</strong>{' '}
              <span className="muted">Upgrade to add more.</span>
            </div>
            <Link to="/upgrade" className="btn-secondary">
              Upgrade
            </Link>
          </div>
        )}

        <ul className="bags-list">
          {bags.map(b => {
            const selected = b.id === selectedBagId
            return (
              <li
                key={b.id}
                className={`bag-list-row${selected ? ' bag-list-row-selected' : ''}`}
              >
                {editingId === b.id ? (
                  <>
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleRename(b.id)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="bag-list-select"
                      onClick={() => setSelectedBagId(b.id)}
                    >
                      <span className="bag-name">
                        {b.name}
                        {b.isDefault && <span className="pill small">Default</span>}
                        {selected && <span className="pill small">Editing</span>}
                      </span>
                    </button>
                    <div className="bag-actions">
                      {!b.isDefault && (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => handleSetDefault(b.id)}
                        >
                          Set default
                        </button>
                      )}
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => {
                          setEditingId(b.id)
                          setEditName(b.name)
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="link-button danger"
                        onClick={() => handleDelete(b.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {selectedBag && (
        <MyBag
          title={selectedBag.name}
          discs={discs}
          busy={discBusy}
          onAdd={handleAddDisc}
          onUpdate={handleUpdateDisc}
          onRemove={handleRemoveDisc}
          onPhotoChange={handlePhotoChange}
        />
      )}
    </div>
  )
}
