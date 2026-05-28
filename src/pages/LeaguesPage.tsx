import { FormEvent, useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { LeagueClubsSection } from '../components/LeagueClubsSection'
import { LeagueDetailTabs } from '../components/LeagueDetailTabs'
import { LeagueDiscoverSection } from '../components/LeagueDiscoverSection'
import { LeagueFeatureGrid } from '../components/LeagueFeatureGrid'
import { playModeLabel, skillLevelLabel } from '../data/leagueFeatures'
import {
  createLeague,
  deleteLeague,
  fetchLeagueStandings,
  joinLeague,
  listMyClubs,
  listMyLeagues,
  submitRoundToLeague,
  updateLeague,
} from '../lib/leagues'
import { listMyRounds } from '../lib/rounds'
import { Club, League, LeagueStanding, RoundSummary } from '../types'

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

function LeagueSettingsFields({
  format,
  playMode,
  handicapEnabled,
  minRounds,
  onFormatChange,
  onPlayModeChange,
  onHandicapChange,
  onMinRoundsChange,
  idPrefix,
}: {
  format: 'stroke' | 'stableford'
  playMode: 'singles' | 'doubles'
  handicapEnabled: boolean
  minRounds: number
  onFormatChange: (v: 'stroke' | 'stableford') => void
  onPlayModeChange: (v: 'singles' | 'doubles') => void
  onHandicapChange: (v: boolean) => void
  onMinRoundsChange: (v: number) => void
  idPrefix: string
}) {
  return (
    <div className="league-settings-fields">
      <div className="league-form-row league-form-dates">
        <label htmlFor={`${idPrefix}-format`}>
          Scoring format
          <select
            id={`${idPrefix}-format`}
            value={format}
            onChange={e => onFormatChange(e.target.value as 'stroke' | 'stableford')}
          >
            <option value="stroke">Stroke (avg score to par)</option>
            <option value="stableford">Stableford (points per round)</option>
          </select>
        </label>
        <label htmlFor={`${idPrefix}-play-mode`}>
          Play mode
          <select
            id={`${idPrefix}-play-mode`}
            value={playMode}
            onChange={e => onPlayModeChange(e.target.value as 'singles' | 'doubles')}
          >
            <option value="singles">Singles</option>
            <option value="doubles">Doubles (pair standings)</option>
          </select>
        </label>
      </div>
      <label className="league-checkbox-label" htmlFor={`${idPrefix}-handicap`}>
        <input
          id={`${idPrefix}-handicap`}
          type="checkbox"
          checked={handicapEnabled}
          onChange={e => onHandicapChange(e.target.checked)}
        />
        Handicap league (net scoring from recent rounds)
      </label>
      <label htmlFor={`${idPrefix}-min-rounds`}>
        Minimum rounds to qualify for standings
        <input
          id={`${idPrefix}-min-rounds`}
          type="number"
          min={0}
          max={50}
          value={minRounds}
          onChange={e => onMinRoundsChange(Number(e.target.value) || 0)}
        />
      </label>
    </div>
  )
}

function LeagueVisibilityFields({
  isPublic,
  skillLevel,
  clubId,
  clubs,
  onPublicChange,
  onSkillLevelChange,
  onClubChange,
  idPrefix,
}: {
  isPublic: boolean
  skillLevel: League['skillLevel']
  clubId: string
  clubs: Club[]
  onPublicChange: (v: boolean) => void
  onSkillLevelChange: (v: League['skillLevel']) => void
  onClubChange: (v: string) => void
  idPrefix: string
}) {
  return (
    <div className="league-visibility-fields">
      <label className="league-checkbox-label" htmlFor={`${idPrefix}-public`}>
        <input
          id={`${idPrefix}-public`}
          type="checkbox"
          checked={isPublic}
          onChange={e => onPublicChange(e.target.checked)}
        />
        Public league (show in Discover for anyone to join)
      </label>
      <label htmlFor={`${idPrefix}-skill`}>
        Skill level tag
        <select
          id={`${idPrefix}-skill`}
          value={skillLevel}
          onChange={e => onSkillLevelChange(e.target.value as League['skillLevel'])}
        >
          <option value="all">All skill levels</option>
          <option value="beginner">Beginner-friendly</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced / competitive</option>
        </select>
      </label>
      {clubs.length > 0 && (
        <label htmlFor={`${idPrefix}-club`}>
          Linked club (optional)
          <select
            id={`${idPrefix}-club`}
            value={clubId}
            onChange={e => onClubChange(e.target.value)}
          >
            <option value="">None</option>
            {clubs.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}

export function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [clubs, setClubs] = useState<Club[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [standings, setStandings] = useState<LeagueStanding[]>([])
  const [rounds, setRounds] = useState<RoundSummary[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [rules, setRules] = useState('')
  const [format, setFormat] = useState<'stroke' | 'stableford'>('stroke')
  const [playMode, setPlayMode] = useState<'singles' | 'doubles'>('singles')
  const [handicapEnabled, setHandicapEnabled] = useState(false)
  const [minRounds, setMinRounds] = useState(0)
  const [isPublic, setIsPublic] = useState(false)
  const [skillLevel, setSkillLevel] = useState<League['skillLevel']>('all')
  const [clubId, setClubId] = useState('')
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
  const [editPlayMode, setEditPlayMode] = useState<'singles' | 'doubles'>('singles')
  const [editHandicapEnabled, setEditHandicapEnabled] = useState(false)
  const [editMinRounds, setEditMinRounds] = useState(0)
  const [editIsPublic, setEditIsPublic] = useState(false)
  const [editSkillLevel, setEditSkillLevel] = useState<League['skillLevel']>('all')
  const [editClubId, setEditClubId] = useState('')
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
    listMyClubs()
      .then(setClubs)
      .catch(() => setClubs([]))
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
    setEditPlayMode(selected.playMode)
    setEditHandicapEnabled(selected.handicapEnabled)
    setEditMinRounds(selected.minRounds)
    setEditIsPublic(selected.isPublic)
    setEditSkillLevel(selected.skillLevel)
    setEditClubId(selected.clubId ?? '')
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

  async function refreshStandings() {
    if (!selectedId) return
    setStandings(await fetchLeagueStandings(selectedId))
    reload()
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
        format,
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        rules: rules.trim() || undefined,
        playMode,
        handicapEnabled,
        minRounds,
        isPublic,
        skillLevel,
        clubId: clubId || null,
      })
      setName('')
      setDescription('')
      setLocation('')
      setRules('')
      setFormat('stroke')
      setPlayMode('singles')
      setHandicapEnabled(false)
      setMinRounds(0)
      setIsPublic(false)
      setSkillLevel('all')
      setClubId('')
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
      await refreshStandings()
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
        playMode: editPlayMode,
        handicapEnabled: editHandicapEnabled,
        minRounds: editMinRounds,
        isPublic: editIsPublic,
        skillLevel: editSkillLevel,
        clubId: editClubId || null,
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
        description="Season standings, chat, ace pots, discovery, clubs, and more."
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
                      <span className="league-format-badge">{playModeLabel(l.playMode)}</span>
                      {l.handicapEnabled && (
                        <span className="league-admin-badge">Handicap</span>
                      )}
                      {l.isPublic && <span className="league-format-badge">Public</span>}
                      {l.skillLevel !== 'all' && (
                        <span className="league-format-badge">{skillLevelLabel(l.skillLevel)}</span>
                      )}
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
              <LeagueSettingsFields
                idPrefix="edit"
                format={editFormat}
                playMode={editPlayMode}
                handicapEnabled={editHandicapEnabled}
                minRounds={editMinRounds}
                onFormatChange={setEditFormat}
                onPlayModeChange={setEditPlayMode}
                onHandicapChange={setEditHandicapEnabled}
                onMinRoundsChange={setEditMinRounds}
              />
              <LeagueVisibilityFields
                idPrefix="edit"
                isPublic={editIsPublic}
                skillLevel={editSkillLevel}
                clubId={editClubId}
                clubs={clubs}
                onPublicChange={setEditIsPublic}
                onSkillLevelChange={setEditSkillLevel}
                onClubChange={setEditClubId}
              />
              <button type="submit" className="btn-primary" disabled={busy}>
                Save changes
              </button>
            </form>
          )}

          <LeagueDetailTabs
            league={selected}
            standings={standings}
            completedRounds={completedRounds}
            busy={busy}
            onBusy={setBusy}
            onError={setError}
            onRefreshStandings={refreshStandings}
            onSubmitRound={handleSubmitRound}
          />
        </section>
      )}

      <LeagueDiscoverSection
        busy={busy}
        onBusy={setBusy}
        onError={setError}
        onJoined={id => {
          reload()
          setSelectedId(id)
        }}
      />

      <LeagueClubsSection busy={busy} onBusy={setBusy} onError={setError} />

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
            <LeagueSettingsFields
              idPrefix="create"
              format={format}
              playMode={playMode}
              handicapEnabled={handicapEnabled}
              minRounds={minRounds}
              onFormatChange={setFormat}
              onPlayModeChange={setPlayMode}
              onHandicapChange={setHandicapEnabled}
              onMinRoundsChange={setMinRounds}
            />
            <LeagueVisibilityFields
              idPrefix="create"
              isPublic={isPublic}
              skillLevel={skillLevel}
              clubId={clubId}
              clubs={clubs}
              onPublicChange={setIsPublic}
              onSkillLevelChange={setSkillLevel}
              onClubChange={setClubId}
            />
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

      <section className="card">
        <LeagueFeatureGrid />
      </section>
    </div>
  )
}
