import { FormEvent, useEffect, useState } from 'react'
import {
  createLeague,
  fetchLeagueStandings,
  joinLeague,
  listMyLeagues,
  submitRoundToLeague,
} from '../lib/leagues'
import { listMyRounds } from '../lib/rounds'
import { formatScoreToPar } from '../lib/rounds'
import { League, LeagueStanding, RoundSummary } from '../types'

export function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [standings, setStandings] = useState<LeagueStanding[]>([])
  const [rounds, setRounds] = useState<RoundSummary[]>([])
  const [name, setName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
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
      return
    }
    fetchLeagueStandings(selectedId)
      .then(setStandings)
      .catch(() => setStandings([]))
  }, [selectedId])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const now = new Date()
      const end = new Date(now)
      end.setMonth(end.getMonth() + 3)
      const { id } = await createLeague({
        name: name.trim(),
        seasonStart: now.toISOString().slice(0, 10),
        seasonEnd: end.toISOString().slice(0, 10),
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

  const selected = leagues.find(l => l.id === selectedId)
  const completedRounds = rounds.filter(r => r.status === 'completed')

  return (
    <div className="container leagues-page">
      <div className="card">
        <h2>Leagues</h2>
        <p className="muted small">
          Season standings with friends — submit completed rounds to your league card.
        </p>
        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleCreate} className="league-form-row">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="League name"
            required
          />
          <button type="submit" className="btn-primary" disabled={busy}>
            Create league
          </button>
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
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selected && (
        <div className="card">
          <h3>{selected.name} standings</h3>
          <p className="muted small">
            Invite code: <code>{selected.inviteCode}</code> · Season{' '}
            {selected.seasonStart} → {selected.seasonEnd}
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
