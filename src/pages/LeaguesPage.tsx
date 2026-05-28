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

function LeagueInfoFields({
  description,
  location,
  rules,
  onDescriptionChange,
  onLocationChange,
  onRulesChange,
  idPrefix,
}: {
  description: string
  location: string
  rules: string
  onDescriptionChange: (v: string) => void
  onLocationChange: (v: string) => void
  onRulesChange: (v: string) => void
  idPrefix: string
}) {
  return (
    <div className="league-info-fields">
      <label htmlFor={`${idPrefix}-description`}>
        About this league
        <textarea
          id={`${idPrefix}-description`}
          value={description}
          onChange={e => onDescriptionChange(e.target.value)}
          placeholder="Weekly doubles at Pier Park, casual season with friends…"
          rows={3}
          maxLength={2000}
        />
      </label>
      <label htmlFor={`${idPrefix}-location`}>
        Where you play
        <input
          id={`${idPrefix}-location`}
          value={location}
          onChange={e => onLocationChange(e.target.value)}
          placeholder="Vancouver, WA · Pier Park · home courses"
          maxLength={200}
        />
      </label>
      <label htmlFor={`${idPrefix}-rules`}>
        House rules (optional)
        <textarea
          id={`${idPrefix}-rules`}
          value={rules}
          onChange={e => onRulesChange(e.target.value)}
          placeholder="Best 8 rounds count, min 9 holes, casual OB…"
          rows={3}
          maxLength={2000}
        />
      </label>
    </div>
  )
}

function LeagueAboutPanel({ league }: { league: League }) {
  const hasCustomInfo = Boolean(league.description || league.location || league.rules)

  return (
    <div className="league-about-panel">
      <h3>About this league</h3>
      {league.creatorName && (
        <p className="muted small league-about-creator">
          Organized by <strong>{league.creatorName}</strong>
        </p>
      )}
      {hasCustomInfo ? (
        <dl className="league-about-list">
          {league.description && (
            <div>
              <dt>Overview</dt>
              <dd>{league.description}</dd>
            </div>
          )}
          {league.location && (
            <div>
              <dt>Where we play</dt>
              <dd>{league.location}</dd>
            </div>
          )}
          {league.rules && (
            <div>
              <dt>House rules</dt>
              <dd>{league.rules}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="muted small">
          No league details yet
          {league.isAdmin ? ' — tap Edit league to add an overview, location, and house rules.' : '.'}
        </p>
      )}

      <div className="league-how-it-works">
        <h4>How this league works</h4>
        <ul className="muted small">
          <li>
            <strong>{formatLabel(league.format)}</strong> scoring — standings rank players by average
            score to par across submitted rounds.
          </li>
          <li>
            Season runs <strong>{formatSeasonRange(league.seasonStart, league.seasonEnd)}</strong>
            {league.seasonStatus === 'active'
              ? ' (in season now).'
              : league.seasonStatus === 'upcoming'
                ? ' (not started yet).'
                : ' (season ended).'}
          </li>
          <li>
            Finished rounds (9+ holes) during an active season can auto-submit to this league when you
            complete a scorecard.
          </li>
          <li>You can also manually submit any completed round from the list below.</li>
          <li>Share the invite code so friends can join and compete on the same standings.</li>
        </ul>
      </div>
    </div>
  )
}

export function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [standings, setStandings] = useState<LeagueStanding[]>([])
  const [rounds, setRounds] = useState<RoundSummary[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [rules, setRules] = useState('')
  const [seasonStart, setSeasonStart] = useState(() => new Date().toISOString().slice(0, 10))
  const [seasonEnd, setSeasonEnd] = useState(defaultSeasonEnd)
  const [inviteCode, setInviteCode] = useState('')
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editRules, setEditRules] = useState('')
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
    setEditDescription(selected.description ?? '')
    setEditLocation(selected.location ?? '')
    setEditRules(selected.rules ?? '')
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
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        rules: rules.trim() || undefined,
      })
      setName('')
      setDescription('')
      setLocation('')
      setRules('')
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
        description: editDescription.trim(),
        location: editLocation.trim(),
        rules: editRules.trim(),
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
        description="Season standings with your group. Add league details so members know what you're playing for."
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

                  {l.description && (
                    <p className="league-card-blurb muted small">{l.description}</p>
                  )}

                  {l.location && (
                    <p className="league-card-location muted small">📍 {l.location}</p>
                  )}

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

          <LeagueAboutPanel league={selected} />

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
              <LeagueInfoFields
                idPrefix="edit"
                description={editDescription}
                location={editLocation}
                rules={editRules}
                onDescriptionChange={setEditDescription}
                onLocationChange={setEditLocation}
                onRulesChange={setEditRules}
              />
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
            <LeagueInfoFields
              idPrefix="create"
              description={description}
              location={location}
              rules={rules}
              onDescriptionChange={setDescription}
              onLocationChange={setLocation}
              onRulesChange={setRules}
            />
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
