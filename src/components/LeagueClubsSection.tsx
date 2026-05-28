import { FormEvent, useEffect, useState } from 'react'
import { createClub, joinClub, listMyClubs } from '../lib/leagues'
import { Club } from '../types'

export function LeagueClubsSection({
  onError,
  busy,
  onBusy,
}: {
  onError: (msg: string | null) => void
  busy: boolean
  onBusy: (v: boolean) => void
}) {
  const [clubs, setClubs] = useState<Club[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  function reload() {
    listMyClubs()
      .then(setClubs)
      .catch(() => setClubs([]))
  }

  useEffect(() => {
    reload()
  }, [])

  async function copyInviteCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      window.setTimeout(() => setCopiedCode(null), 2000)
    } catch {
      onError('Could not copy invite code')
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    onBusy(true)
    onError(null)
    try {
      await createClub({
        name: name.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
      })
      setName('')
      setDescription('')
      setLocation('')
      setShowCreate(false)
      reload()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not create club')
    } finally {
      onBusy(false)
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault()
    onBusy(true)
    onError(null)
    try {
      await joinClub(inviteCode.trim())
      setInviteCode('')
      reload()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not join club')
    } finally {
      onBusy(false)
    }
  }

  return (
    <section className="card">
      <h2 className="section-title">Clubs</h2>
      <p className="muted small">
        Organize multiple leagues under one club — link a club when creating or editing a league.
      </p>

      {clubs.length > 0 && (
        <ul className="league-club-list">
          {clubs.map(c => (
            <li key={c.id} className="league-club-item">
              <div>
                <h3>
                  {c.name}
                  {c.myRole === 'admin' && <span className="league-admin-badge">Admin</span>}
                </h3>
                {c.description && <p className="muted small">{c.description}</p>}
                {c.location && <p className="muted small">📍 {c.location}</p>}
                <p className="muted small">{c.memberCount} members</p>
              </div>
              <div className="league-card-invite">
                <span className="muted small">Invite</span>
                <code>{c.inviteCode}</code>
                <button
                  type="button"
                  className="league-copy-btn"
                  onClick={() => copyInviteCode(c.inviteCode)}
                >
                  {copiedCode === c.inviteCode ? 'Copied' : 'Copy'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleJoin} className="league-form-row">
        <input
          value={inviteCode}
          onChange={e => setInviteCode(e.target.value)}
          placeholder="Club invite code"
          required
        />
        <button type="submit" className="btn-secondary" disabled={busy}>
          Join club
        </button>
      </form>

      {!showCreate ? (
        <button
          type="button"
          className="btn-secondary league-create-toggle"
          onClick={() => setShowCreate(true)}
        >
          + Create a club
        </button>
      ) : (
        <form onSubmit={handleCreate} className="league-create-form">
          <label>
            Club name
            <input value={name} onChange={e => setName(e.target.value)} required />
          </label>
          <label>
            About
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              maxLength={2000}
            />
          </label>
          <label>
            Location
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              maxLength={200}
            />
          </label>
          <div className="league-form-row">
            <button type="submit" className="btn-primary" disabled={busy}>
              Create club
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
