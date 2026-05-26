import { FormEvent, useEffect, useState } from 'react'
import {
  createLeague,
  deleteLeague,
  fetchLeagueStandings,
  joinLeague,
  listMyLeagues,
  submitRoundToLeague,
  updateLeague,
} from '../lib/leagues'
import { listMyRounds } from '../lib/rounds'
import { formatScoreToPar } from '../lib/rounds'
import { League, LeagueStanding, RoundSummary } from '../types'

function defaultSeasonEnd(): string {
  const end = new Date()
  end.setMonth(end.getMonth() + 3)
  return end.toISOString().slice(0, 10)
}

export function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [standings, setStandings] = useState<LeagueStanding[]>([])
  const [rounds, setRounds] = useState<RoundSummary[]>([])
  const [name, setName] = useState('')
  const [seasonStart, setSeasonStart] = useState(() => new Date().toISOString().slice(0, 10))
  const [seasonEnd, setSeasonEnd] = useState(defaultSeasonEnd)
  const [inviteCode, setInviteCode] = useState('')
  const [editName, setEditName] = useState('')
  const [editSeasonStart, setEditSeasonStart] = useState('')
  const [editSeasonEnd, setEditSeasonEnd] = useState('')
  const [editFormat, setEditFormat] = useState<'stroke' | 'stableford'>('stroke')
  const [showEdit, setShowEdit] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reload() {
    listMyLeagues()
      .then(setLeagues)
      .catch(() => setLeagues([]))
  }

  useEffect(() => {
    reload()
    listMyRounds()
      .then(setRounds)
      .catch(() => setRounds([]))
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setStandings([])
      setShowEdit(false)
      return
    }
    fetchLeagueStandings(selectedId)
      .then(setStandings)
      .catch(() => setStandings([]))
  }, [selectedId])

  const selected = leagues.find(l => l.id === selectedId)
  const completedRounds = rounds.filter(r => r.status === 'completed')

  useEffect(() => {
    if (!selected) {
      setShowEdit(false)
      return
    }
    setEditName(selected.name)
    setEditSeasonStart(selected.seasonStart)
    setEditSeasonEnd(selected.seasonEnd)
    setEditFormat(selected.format === 'stableford' ? 'stableford' : 'stroke')
  }, [selected])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { id } = await createLeague({
        name: name.trim(),
        seasonStart,
        seasonEnd,
      })
      setName('')
      reload()
      setSelectedId(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create league')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const id = await joinLeague(inviteCode.trim())
      setInviteCode('')
      reload()
      setSelectedId(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join league')
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmitRound(roundId: string) {
    if (!selectedId) return
    setBusy(true)
    try {
      await submitRoundToLeague(selectedId, roundId)
      setStandings(await fetchLeagueStandings(selectedId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit round')
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (!selectedId || !selected?.isAdmin) return
    setBusy(true)
    setError(null)
    try {
      await updateLeague(selectedId, {
        name: editName.trim(),
        seasonStart: editSeasonStart,
        seasonEnd: editSeasonEnd,
        format: editFormat,
      })
      reload()
      setShowEdit(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update league')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!selectedId || !selected?.isAdmin) return
    if (
      !window.confirm(
        `Delete "${selected.name}"? This removes all members, standings, and submitted rounds. This cannot be undone.`,
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await deleteLeague(selectedId)
      setSelectedId(null)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete league')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container leagues-page">
      <div className="card">
        <h2>Leagues</h2>
        <p className="muted small">
          Season standings with friends — completed rounds (9+ holes) in season
          auto-submit when you end a round. Manual submit still available below.
        </p>
        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleCreate} className="league-create-form">
          <div className="league-form-row">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="League name"
              required
            />
            <button type="submit" className="btn-primary" disabled={busy}>
              Create league
            </button>
          </div>
          <div className="league-form-row league-form-dates">
            <label>
              Season start
              <input
                type="date"
                value={seasonStart}
                onChange={e => setSeasonStart(e.target.value)}
                required
              />
            </label>
            <label>
              Season end
              <input
                type="date"
                value={seasonEnd}
                onChange={e => setSeasonEnd(e.target.value)}
                required
              />
            </label>
          </div>
        </form>

        <form onSubmit={handleJoin} className="league-form-row">
          <input
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value)}
            placeholder="Invite code"
            required
          />
          <button type="submit" className="btn-secondary" disabled={busy}>
            Join
          </button>
        </form>
      </div>

      {leagues.length > 0 && (
        <div className="card">
          <h3>Your leagues</h3>
          <ul className="league-list">
            {leagues.map(l => (
              <li key={l.id}>
                <button
                  type="button"
                  className={`link-button${selectedId === l.id ? ' active' : ''}`}
                  onClick={() => setSelectedId(l.id)}
                >
                  {l.name} · {l.memberCount} players
                  {l.isAdmin && <span className="league-admin-tag"> · Admin</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selected && (
        <div className="card">
          <div className="league-detail-head">
            <h3>{selected.name} standings</h3>
            {selected.isAdmin && (
              <div className="league-admin-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => setShowEdit(v => !v)}
                >
                  {showEdit ? 'Cancel edit' : 'Edit league'}
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  disabled={busy}
                  onClick={handleDelete}
                >
                  Delete league
                </button>
              </div>
            )}
          </div>

          {showEdit && selected.isAdmin && (
            <form onSubmit={handleSaveEdit} className="league-edit-form">
              <label>
                Name
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  required
                />
              </label>
              <div className="league-form-row league-form-dates">
                <label>
                  Season start
                  <input
                    type="date"
                    value={editSeasonStart}
                    onChange={e => setEditSeasonStart(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Season end
                  <input
                    type="date"
                    value={editSeasonEnd}
                    onChange={e => setEditSeasonEnd(e.target.value)}
                    required
                  />
                </label>
              </div>
              <label>
                Format
                <select
                  value={editFormat}
                  onChange={e => setEditFormat(e.target.value as 'stroke' | 'stableford')}
                >
                  <option value="stroke">Stroke</option>
                  <option value="stableford">Stableford</option>
                </select>
              </label>
              <button type="submit" className="btn-primary" disabled={busy}>
                Save changes
              </button>
            </form>
          )}

          <p className="muted small">
            Invite code: <code>{selected.inviteCode}</code> · Season{' '}
            {selected.seasonStart} → {selected.seasonEnd} · {selected.format}
          </p>
          {standings.length === 0 ? (
            <p className="muted">No submitted rounds yet.</p>
          ) : (
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>Rounds</th>
                  <th>Avg +/-</th>
                  <th>Best</th>
                </tr>
              </thead>
              <tbody>
                {standings.map(s => (
                  <tr key={s.userId}>
                    <td>{s.rank}</td>
                    <td>{s.displayName}</td>
                    <td>{s.roundsSubmitted}</td>
                    <td>
                      {s.avgScoreToPar != null ? formatScoreToPar(s.avgScoreToPar) : '—'}
                    </td>
                    <td>
                      {s.bestScoreToPar != null ? formatScoreToPar(s.bestScoreToPar) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {completedRounds.length > 0 && (
            <>
              <h4>Submit a round</h4>
              <ul className="stats-recent-list">
                {completedRounds.slice(0, 8).map(r => (
                  <li key={r.id}>
                    {r.courseName ?? 'Round'} — {formatScoreToPar(r.scoreToPar)}{' '}
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busy}
                      onClick={() => handleSubmitRound(r.id)}
                    >
                      Submit
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
