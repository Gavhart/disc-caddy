import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  createBag,
  deleteBag,
  listBags,
  renameBag,
  setDefaultBag,
} from '../lib/bags'
import { FREE_TIER } from '../lib/subscription'
import { Bag } from '../types'

export function BagsListPage() {
  const { me } = useAuth()
  const isPro = me?.isPro ?? false
  const [bags, setBags] = useState<Bag[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    listBags().then(setBags).catch(err => setError(err.message))
  }, [])

  const reachedFreeLimit = !isPro && bags.length >= FREE_TIER.maxBags

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return
    if (reachedFreeLimit) return
    setBusy(true)
    try {
      const created = await createBag(newName.trim())
      setBags(prev => [...prev, created])
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
      setBags(prev => prev.filter(b => b.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }, [])

  const handleSetDefault = useCallback(async (id: string) => {
    try {
      await setDefaultBag(id)
      setBags(prev => prev.map(b => ({ ...b, isDefault: b.id === id })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    }
  }, [])

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h2>Your Bags</h2>
          {!creating && !reachedFreeLimit && (
            <button
              className="btn-secondary"
              onClick={() => setCreating(true)}
              disabled={busy}
            >
              + New bag
            </button>
          )}
        </div>

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
            <button className="btn-secondary" onClick={handleCreate} disabled={busy}>
              Create
            </button>
            <button className="link-button" onClick={() => setCreating(false)}>
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
          {bags.map(b => (
            <li key={b.id} className="bag-list-row">
              {editingId === b.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    autoFocus
                  />
                  <button
                    className="btn-secondary"
                    onClick={() => handleRename(b.id)}
                  >
                    Save
                  </button>
                  <button
                    className="link-button"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <div className="bag-name">
                    {b.name}
                    {b.isDefault && <span className="pill small">Default</span>}
                  </div>
                  <div className="bag-actions">
                    {!b.isDefault && (
                      <button
                        className="link-button"
                        onClick={() => handleSetDefault(b.id)}
                      >
                        Set default
                      </button>
                    )}
                    <button
                      className="link-button"
                      onClick={() => {
                        setEditingId(b.id)
                        setEditName(b.name)
                      }}
                    >
                      Rename
                    </button>
                    <button
                      className="link-button danger"
                      onClick={() => handleDelete(b.id)}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
