import { FormEvent, useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
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

function formatSeasonRange(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  return `${fmt(start)} – ${fmt(end)}`
}

function seasonStatusLabel(status: League['seasonStatus']): string {
  if (status === 'upcoming') return 'Upcoming'
  if (status === 'ended') return 'Season ended'
  return 'In season'
}

function formatLabel(format: string): string {
  return format === 'stableford' ? 'Stableford' : 'Stroke'
}

export function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [standings, setStandings] = useState<LeagueStanding[]>([])
  const [rounds, setRounds] = useState<RoundSummary[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [seasonStart, setSeasonStart] = useState(() => new Date().toISOString().slice(0, 10))
  const [seasonEnd, setSeasonEnd] = useState(defaultSeasonEnd)
  const [inviteCode, setInviteCode] = useState('')
  const [editName, setEditName] = useState('')
  const [editSeasonStart, setEditSeasonStart] = useState('')
  const [editSeasonEnd, setEditSeasonEnd] = useState('')
  const [editFormat, setEditFormat] = useState<'stroke' | 'stableford'>('stroke')
  const [showEdit, setShowEdit] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reload() {
    listMyLeagues()
      .then(rows => {
        setLeagues(rows)
        if (rows.length > 0 && !selectedId) setSelectedId(rows[0].id)
      })
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

  async function copyInviteCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      window.setTimeout(() => setCopiedCode(null), 2000)
    } catch {
      setError('Could not copy invite code')
    }
  }

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
      setShowCreate(false)
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
      reload()
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
      <PageHeader
        title="Leagues"
        description="Season standings with your group. Completed rounds auto-submit when you finish."
        backTo="/social"
        backLabel="Social"
      />

      {error && <div className="form-error">{error}</div>}

      <section className="card">
        <h2 className="section-title">Your leagues</h2>

        {leagues.length === 0 ? (
          <p className="muted">
            No leagues yet — create one for your group or join with an invite code below.
          </p>
        ) : (
          <ul className="league-card-grid">
            {leagues.map(l => (
              <li key={l.id}>
                <button
                  type="button"
                  className={'league-card' + (selectedId === l.id ? ' league-card-selected' : '')}
                  onClick={() => setSelectedId(l.id)}
                >
                  <div className="league-card-top">
                    <h3>{l.name}</h3>
                    <div className="league-card-badges">
                      <span className={'league-season-badge league-season-' + l.seasonStatus}>
                        {seasonStatusLabel(l.seasonStatus)}
                      </span>
                      <span className="league-format-badge">{formatLabel(l.format)}</span>
                      {l.isAdmin && <span className="league-admin-badge">Admin</span>}
                    </div>
                  </div>

                  <p className="league-card-season muted small">
                    {formatSeasonRange(l.seasonStart, l.seasonEnd)}
                  </p>

                  <dl className="league-card-stats">
                    <div>
                      <dt>Members</dt>
                      <dd>{l.memberCount}</dd>
                    </div>
                    <div>
                      <dt>Rounds logged</dt>
                      <dd>{l.roundsSubmitted}</dd>
                    </div>
                    <div>
                      <dt>Your rounds</dt>
                      <dd>{l.myRoundsSubmitted}</dd>
                    </div>
                  </dl>

                  {l.leaderName && l.roundsSubmitted > 0 && (
                    <p className="league-card-leader small">
                      Leader: <strong>{l.leaderName}</strong>
                    </p>
                  )}

                  <div className="league-card-invite">
                    <span className="muted small">Invite</span>
                    <code>{l.inviteCode}</code>
                    <span
                      role="button"
                      tabIndex={0}
                      className="league-copy-btn"
                      onClick={e => {
                        e.stopPropagation()
                        copyInviteCode(l.inviteCode)
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          copyInviteCode(l.inviteCode)
                        }
                      }}
                    >
                      {copiedCode === l.inviteCode ? 'Copied' : 'Copy'}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <section className="card league-detail-card">
          <div className="league-detail-head">
            <div>
              <h2>{selected.name}</h2>
              <p className="muted small league-detail-meta">
                {formatSeasonRange(selected.seasonStart, selected.seasonEnd)} ·{' '}
                {formatLabel(selected.format)} · {selected.memberCount} members ·{' '}
                {selected.playersWithRounds} playing · {selected.roundsSubmitted} rounds logged
              </p>
            </div>
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

          <h3>Standings</h3>
          {standings.length === 0 ? (
            <p className="muted">No submitted rounds yet — play a round and submit it below.</p>
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
        </section>
      )}

      <section className="card">
        <div className="leagues-section-head">
          <h2>Join or create</h2>
        </div>

        <form onSubmit={handleJoin} className="league-form-row">
          <input
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value)}
            placeholder="Paste invite code to join"
            required
          />
          <button type="submit" className="btn-secondary" disabled={busy}>
            Join league
          </button>
        </form>

        {!showCreate ? (
          <button
            type="button"
            className="btn-secondary league-create-toggle"
            onClick={() => setShowCreate(true)}
          >
            + Create a new league
          </button>
        ) : (
          <form onSubmit={handleCreate} className="league-create-form">
            <div className="league-form-row">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="League name"
                required
              />
              <button type="submit" className="btn-primary" disabled={busy}>
                Create
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
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
