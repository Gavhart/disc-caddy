import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { playModeLabel, skillLevelLabel } from '../data/leagueFeatures'
import { LeaguePairReveal, LeaguePairShuffle } from './LeaguePairShuffle'
import { LeaguePairRoundModal } from './LeaguePairRoundModal'
import { LeagueStandingsHero } from './LeagueStandingsHero'
import { VenmoIntegrationPanel } from './VenmoIntegrationPanel'
import {
  addLeaguePotEntry,
  createLeaguePair,
  deleteLeaguePair,
  fetchLeaguePairStandings,
  fetchLeaguePot,
  fetchLeagueRivalries,
  fetchLeagueStreaks,
  listLeagueAnnouncements,
  listLeagueMembers,
  listLeagueMessages,
  listLeaguePairs,
  listLeagueLivePairs,
  listLeaguePotEntries,
  postLeagueAnnouncement,
  refreshLeagueHandicaps,
  sendLeagueMessage,
} from '../lib/leagues'
import { formatScoreToPar } from '../lib/rounds'
import {
  League,
  LeagueAnnouncement,
  LeagueMessage,
  LeaguePair,
  LeaguePairStanding,
  LeaguePot,
  LeaguePotEntry,
  LeagueRivalry,
  LeagueStanding,
  LeagueStreak,
  RoundSummary,
  ShuffleLeaguePairsResult,
} from '../types'

type LeagueTab =
  | 'overview'
  | 'standings'
  | 'chat'
  | 'announcements'
  | 'pot'
  | 'pairs'
  | 'rivalries'

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

function formatMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(
    cents / 100,
  )
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function LeagueAboutContent({ league }: { league: League }) {
  const hasCustomInfo = Boolean(league.description || league.location || league.rules)

  return (
    <div className="league-about-panel">
      <h3>About this league</h3>
      {league.creatorName && (
        <p className="muted small league-about-creator">
          Organized by <strong>{league.creatorName}</strong>
        </p>
      )}

      <div className="league-card-badges league-about-badges">
        <span className={'league-season-badge league-season-' + league.seasonStatus}>
          {seasonStatusLabel(league.seasonStatus)}
        </span>
        <span className="league-format-badge">{formatLabel(league.format)}</span>
        <span className="league-format-badge">{playModeLabel(league.playMode)}</span>
        {league.handicapEnabled && <span className="league-admin-badge">Handicap</span>}
        {league.isPublic && <span className="league-format-badge">Public</span>}
        {league.skillLevel !== 'all' && (
          <span className="league-format-badge">{skillLevelLabel(league.skillLevel)}</span>
        )}
        {league.minRounds > 0 && (
          <span className="league-format-badge">Min {league.minRounds} rounds</span>
        )}
      </div>

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
            <strong>{formatLabel(league.format)}</strong> scoring
            {league.format === 'stableford'
              ? ' — standings rank by average Stableford points (higher is better).'
              : league.handicapEnabled
                ? ' — standings rank by net score to par when handicaps are enabled.'
                : ' — standings rank by average score to par (lower is better).'}
          </li>
          <li>
            <strong>{playModeLabel(league.playMode)}</strong> league
            {league.playMode === 'doubles'
              ? ' — pair standings count rounds where both partners submitted the same round. Shuffle teams on the Pairs tab, then start a live scorecard together.'
              : ' — individual player standings.'}
          </li>
          {league.handicapEnabled && (
            <li>
              <strong>Handicap league</strong> — indexes refresh from your last 10 rounds. Admins can
              recalculate anytime from the Standings tab.
            </li>
          )}
          {league.minRounds > 0 && (
            <li>
              Players need at least <strong>{league.minRounds}</strong> submitted rounds to qualify
              for official standings.
            </li>
          )}
          <li>
            Season runs <strong>{formatSeasonRange(league.seasonStart, league.seasonEnd)}</strong>.
          </li>
          <li>Completed rounds auto-submit during an active season, or submit manually below.</li>
        </ul>
      </div>
    </div>
  )
}

function StandingsTable({
  league,
  standings,
  pairStandings,
  myPairStanding,
  currentUserId,
}: {
  league: League
  standings: LeagueStanding[]
  pairStandings: LeaguePairStanding[]
  myPairStanding?: LeaguePairStanding | null
  currentUserId?: string | null
}) {
  const hasData =
    standings.length > 0 || (league.playMode === 'doubles' && pairStandings.length > 0)

  return (
    <>
      {hasData && (
        <LeagueStandingsHero
          league={league}
          standings={standings}
          pairStandings={pairStandings}
          myPairStanding={myPairStanding}
          currentUserId={currentUserId}
        />
      )}
      {league.playMode === 'doubles' && pairStandings.length > 0 && (
        <>
          <h4>Pair standings</h4>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Pair</th>
                <th>Rounds</th>
                <th>Avg combined +/-</th>
              </tr>
            </thead>
            <tbody>
              {pairStandings.map(s => (
                <tr key={s.pairId}>
                  <td>{s.rank}</td>
                  <td>{s.pairName}</td>
                  <td>{s.roundsTogether}</td>
                  <td>
                    {s.avgCombinedToPar != null ? formatScoreToPar(s.avgCombinedToPar) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4>Individual standings</h4>
        </>
      )}

      {standings.length === 0 && !hasData ? (
        <p className="muted">No submitted rounds yet — play a round and submit it below.</p>
      ) : standings.length === 0 ? null : (
        <StandingsTableBody league={league} standings={standings} />
      )}
    </>
  )
}

function StandingsTableBody({
  league,
  standings,
}: {
  league: League
  standings: LeagueStanding[]
}) {
  if (league.playMode === 'doubles' && standings.length === 0) {
    return null
  }

  const showNet = league.handicapEnabled && league.format === 'stroke'

  return (
    <table className="leaderboard-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>Rounds</th>
          {league.format === 'stableford' ? (
            <>
              <th>Avg pts</th>
              <th>Best pts</th>
            </>
          ) : showNet ? (
            <>
              <th>Net +/-</th>
              <th>Gross +/-</th>
              <th>HCP</th>
            </>
          ) : (
            <>
              <th>Avg +/-</th>
              <th>Best</th>
            </>
          )}
          {league.minRounds > 0 && <th>Qualified</th>}
        </tr>
      </thead>
      <tbody>
        {standings.map(s => (
          <tr key={s.userId} className={s.qualified === false ? 'league-unqualified-row' : undefined}>
            <td>{s.rank}</td>
            <td>{s.displayName}</td>
            <td>{s.roundsSubmitted}</td>
            {league.format === 'stableford' ? (
              <>
                <td>{s.avgStablefordPoints ?? '—'}</td>
                <td>{s.bestStablefordPoints ?? '—'}</td>
              </>
            ) : showNet ? (
              <>
                <td>
                  {s.avgNetScoreToPar != null ? formatScoreToPar(s.avgNetScoreToPar) : '—'}
                </td>
                <td>
                  {s.avgScoreToPar != null ? formatScoreToPar(s.avgScoreToPar) : '—'}
                </td>
                <td>{s.handicapIndex != null ? s.handicapIndex.toFixed(1) : '—'}</td>
              </>
            ) : (
              <>
                <td>
                  {s.avgScoreToPar != null ? formatScoreToPar(s.avgScoreToPar) : '—'}
                </td>
                <td>
                  {s.bestScoreToPar != null ? formatScoreToPar(s.bestScoreToPar) : '—'}
                </td>
              </>
            )}
            {league.minRounds > 0 && (
              <td>{s.qualified ? 'Yes' : `Need ${league.minRounds - s.roundsSubmitted} more`}</td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function LeagueDetailTabs({
  league,
  standings,
  completedRounds,
  busy,
  onBusy,
  onError,
  onRefreshStandings,
  onSubmitRound,
}: {
  league: League
  standings: LeagueStanding[]
  completedRounds: RoundSummary[]
  busy: boolean
  onBusy: (v: boolean) => void
  onError: (msg: string | null) => void
  onRefreshStandings: () => Promise<void>
  onSubmitRound: (roundId: string) => Promise<void>
}) {
  const { me, user } = useAuth()
  const isPro = me?.isPro ?? false
  const [tab, setTab] = useState<LeagueTab>('overview')
  const [messages, setMessages] = useState<LeagueMessage[]>([])
  const [announcements, setAnnouncements] = useState<LeagueAnnouncement[]>([])
  const [pot, setPot] = useState<LeaguePot | null>(null)
  const [potEntries, setPotEntries] = useState<LeaguePotEntry[]>([])
  const [pairs, setPairs] = useState<LeaguePair[]>([])
  const [pairStandings, setPairStandings] = useState<LeaguePairStanding[]>([])
  const [rivalries, setRivalries] = useState<LeagueRivalry[]>([])
  const [streaks, setStreaks] = useState<LeagueStreak[]>([])
  const [members, setMembers] = useState<{ userId: string; displayName: string }[]>([])

  const [chatBody, setChatBody] = useState('')
  const [announceTitle, setAnnounceTitle] = useState('')
  const [announceBody, setAnnounceBody] = useState('')
  const [potAmount, setPotAmount] = useState('')
  const [potNote, setPotNote] = useState('')
  const [pairPlayer1, setPairPlayer1] = useState('')
  const [pairPlayer2, setPairPlayer2] = useState('')
  const [pairName, setPairName] = useState('')
  const [shuffleSitOut, setShuffleSitOut] = useState<string | null>(null)
  const [justShuffled, setJustShuffled] = useState(false)
  const [startRoundPair, setStartRoundPair] = useState<LeaguePair | null>(null)
  const [livePairIds, setLivePairIds] = useState<Set<string>>(new Set())

  const myPairStanding = useMemo(() => {
    if (!user?.id || league.playMode !== 'doubles') return null
    const myPair = pairs.find(p => p.player1Id === user.id || p.player2Id === user.id)
    if (!myPair) return null
    return pairStandings.find(s => s.pairId === myPair.id) ?? null
  }, [pairs, pairStandings, user?.id, league.playMode])

  const tabs: { id: LeagueTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'standings', label: 'Standings' },
    { id: 'chat', label: 'Chat' },
    { id: 'announcements', label: 'News' },
    { id: 'pot', label: 'Ace pot' },
  ]
  if (league.playMode === 'doubles') tabs.push({ id: 'pairs', label: 'Pairs' })
  tabs.push({ id: 'rivalries', label: 'Rivalries' })

  useEffect(() => {
    setTab('overview')
    setJustShuffled(false)
    setShuffleSitOut(null)
  }, [league.id])

  useEffect(() => {
    if (!justShuffled) return
    const timer = window.setTimeout(() => setJustShuffled(false), 4000)
    return () => window.clearTimeout(timer)
  }, [justShuffled])

  useEffect(() => {
    if (tab === 'chat') {
      listLeagueMessages(league.id)
        .then(setMessages)
        .catch(() => setMessages([]))
    } else if (tab === 'announcements') {
      listLeagueAnnouncements(league.id)
        .then(setAnnouncements)
        .catch(() => setAnnouncements([]))
    } else if (tab === 'pot') {
      Promise.all([fetchLeaguePot(league.id), listLeaguePotEntries(league.id)])
        .then(([p, entries]) => {
          setPot(p)
          setPotEntries(entries)
        })
        .catch(() => {
          setPot(null)
          setPotEntries([])
        })
    } else if (tab === 'pairs') {
      Promise.all([
        listLeaguePairs(league.id),
        fetchLeaguePairStandings(league.id),
        listLeagueMembers(league.id),
        listLeagueLivePairs(league.id).catch(() => []),
      ])
        .then(([p, ps, m, live]) => {
          setPairs(p)
          setPairStandings(ps)
          setMembers(m)
          setLivePairIds(new Set(live.map(row => row.pairId)))
        })
        .catch(() => {
          setPairs([])
          setPairStandings([])
          setMembers([])
          setLivePairIds(new Set())
        })
    } else if (tab === 'rivalries') {
      Promise.all([fetchLeagueRivalries(league.id), fetchLeagueStreaks(league.id)])
        .then(([r, s]) => {
          setRivalries(r)
          setStreaks(s)
        })
        .catch(() => {
          setRivalries([])
          setStreaks([])
        })
    } else if (tab === 'standings' && league.playMode === 'doubles') {
      Promise.all([
        fetchLeaguePairStandings(league.id),
        listLeaguePairs(league.id),
      ])
        .then(([ps, p]) => {
          setPairStandings(ps)
          setPairs(p)
        })
        .catch(() => {
          setPairStandings([])
        })
    }
  }, [tab, league.id, league.playMode])

  async function handleSendChat(e: FormEvent) {
    e.preventDefault()
    const body = chatBody.trim()
    if (!body) return
    onBusy(true)
    onError(null)
    try {
      await sendLeagueMessage(league.id, body)
      setChatBody('')
      setMessages(await listLeagueMessages(league.id))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not send message')
    } finally {
      onBusy(false)
    }
  }

  async function handlePostAnnouncement(e: FormEvent) {
    e.preventDefault()
    if (!league.isAdmin) return
    onBusy(true)
    onError(null)
    try {
      await postLeagueAnnouncement(league.id, announceTitle.trim(), announceBody.trim())
      setAnnounceTitle('')
      setAnnounceBody('')
      setAnnouncements(await listLeagueAnnouncements(league.id))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not post announcement')
    } finally {
      onBusy(false)
    }
  }

  async function handleAddPotEntry(e: FormEvent) {
    e.preventDefault()
    const dollars = Number(potAmount)
    if (!Number.isFinite(dollars) || dollars <= 0) {
      onError('Enter a valid pot amount')
      return
    }
    onBusy(true)
    onError(null)
    try {
      await addLeaguePotEntry(league.id, Math.round(dollars * 100), potNote.trim() || undefined)
      setPotAmount('')
      setPotNote('')
      const [p, entries] = await Promise.all([
        fetchLeaguePot(league.id),
        listLeaguePotEntries(league.id),
      ])
      setPot(p)
      setPotEntries(entries)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not add pot entry')
    } finally {
      onBusy(false)
    }
  }

  async function handleCreatePair(e: FormEvent) {
    e.preventDefault()
    if (!league.isAdmin || !pairPlayer1 || !pairPlayer2) return
    if (pairPlayer1 === pairPlayer2) {
      onError('Pick two different players')
      return
    }
    onBusy(true)
    onError(null)
    try {
      await createLeaguePair(league.id, pairPlayer1, pairPlayer2, pairName.trim() || undefined)
      setPairPlayer1('')
      setPairPlayer2('')
      setPairName('')
      const [p, ps] = await Promise.all([
        listLeaguePairs(league.id),
        fetchLeaguePairStandings(league.id),
      ])
      setPairs(p)
      setPairStandings(ps)
      await onRefreshStandings()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not create pair')
    } finally {
      onBusy(false)
    }
  }

  async function handleDeletePair(pairId: string) {
    if (!league.isAdmin) return
    if (!window.confirm('Remove this pair?')) return
    onBusy(true)
    onError(null)
    try {
      await deleteLeaguePair(pairId)
      const [p, ps] = await Promise.all([
        listLeaguePairs(league.id),
        fetchLeaguePairStandings(league.id),
      ])
      setPairs(p)
      setPairStandings(ps)
      await onRefreshStandings()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not remove pair')
    } finally {
      onBusy(false)
    }
  }

  async function handleRefreshHandicaps() {
    if (!league.isAdmin) return
    onBusy(true)
    onError(null)
    try {
      const updated = await refreshLeagueHandicaps(league.id)
      await onRefreshStandings()
      onError(null)
      window.alert(`Updated handicaps for ${updated} player${updated === 1 ? '' : 's'}.`)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not refresh handicaps')
    } finally {
      onBusy(false)
    }
  }

  return (
    <div className="league-detail-tabs">
      <div className="league-tab-bar" role="tablist">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={'league-tab' + (tab === t.id ? ' league-tab-active' : '')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="league-tab-panel">
        {tab === 'overview' && (
          <>
            <LeagueAboutContent league={league} />
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
                        onClick={() => onSubmitRound(r.id)}
                      >
                        Submit
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        {tab === 'standings' && (
          <>
            {league.handicapEnabled && league.isAdmin && (
              <div className="league-tab-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={handleRefreshHandicaps}
                >
                  Refresh handicaps
                </button>
              </div>
            )}
            <StandingsTable
              league={league}
              standings={standings}
              pairStandings={pairStandings}
              myPairStanding={myPairStanding}
              currentUserId={user?.id}
            />
          </>
        )}

        {tab === 'chat' && (
          <>
            {messages.length === 0 ? (
              <p className="muted">No messages yet — say hi to your league.</p>
            ) : (
              <ul className="league-message-list">
                {messages.map(m => (
                  <li key={m.id} className="league-message-item">
                    <div className="league-message-head">
                      <strong>{m.senderName}</strong>
                      <span className="muted small">{formatWhen(m.createdAt)}</span>
                    </div>
                    <p>{m.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={handleSendChat} className="league-inline-form">
              <textarea
                value={chatBody}
                onChange={e => setChatBody(e.target.value)}
                placeholder="Message your league…"
                rows={2}
                maxLength={2000}
                required
              />
              <button type="submit" className="btn-primary" disabled={busy}>
                Send
              </button>
            </form>
          </>
        )}

        {tab === 'announcements' && (
          <>
            {announcements.length === 0 ? (
              <p className="muted">No announcements yet.</p>
            ) : (
              <ul className="league-announce-list">
                {announcements.map(a => (
                  <li key={a.id} className="league-announce-item">
                    <div className="league-announce-head">
                      <strong>{a.title}</strong>
                      <span className="muted small">
                        {a.authorName} · {formatWhen(a.createdAt)}
                      </span>
                    </div>
                    <p>{a.body}</p>
                  </li>
                ))}
              </ul>
            )}
            {league.isAdmin && (
              <form onSubmit={handlePostAnnouncement} className="league-inline-form">
                <input
                  value={announceTitle}
                  onChange={e => setAnnounceTitle(e.target.value)}
                  placeholder="Announcement title"
                  maxLength={120}
                  required
                />
                <textarea
                  value={announceBody}
                  onChange={e => setAnnounceBody(e.target.value)}
                  placeholder="Details for all league members…"
                  rows={3}
                  maxLength={4000}
                  required
                />
                <button type="submit" className="btn-primary" disabled={busy}>
                  Post announcement
                </button>
              </form>
            )}
          </>
        )}

        {tab === 'pot' && (
          <>
            {pot ? (
              <div className="league-pot-summary">
                <h4>{pot.label}</h4>
                <p className="league-pot-balance">{formatMoney(pot.balanceCents)}</p>
                {pot.entryFeeCents > 0 && (
                  <p className="muted small">
                    Suggested entry: {formatMoney(pot.entryFeeCents)}
                  </p>
                )}
              </div>
            ) : (
              <p className="muted">Ace pot not available yet.</p>
            )}
            {potEntries.length > 0 && (
              <ul className="league-pot-entries">
                {potEntries.map(e => (
                  <li key={e.id}>
                    <strong>{formatMoney(e.amountCents)}</strong> — {e.playerName}
                    {e.note ? ` · ${e.note}` : ''}
                    <span className="muted small"> · {formatWhen(e.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={handleAddPotEntry} className="league-inline-form">
              <label>
                Add to pot ($)
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={potAmount}
                  onChange={e => setPotAmount(e.target.value)}
                  placeholder="5.00"
                  required
                />
              </label>
              <input
                value={potNote}
                onChange={e => setPotNote(e.target.value)}
                placeholder="Optional note (ace on 7, weekly buy-in…)"
                maxLength={200}
              />
              <button type="submit" className="btn-primary" disabled={busy}>
                Log contribution
              </button>
            </form>
            <VenmoIntegrationPanel
              leagueId={league.id}
              leagueName={league.name}
              pot={pot}
              isAdmin={league.isAdmin}
              busy={busy}
              userVenmoUsername={me?.venmoUsername}
              onBusy={onBusy}
              onError={onError}
              onPotUpdated={updated => setPot(updated)}
            />
          </>
        )}

        {tab === 'pairs' && league.playMode === 'doubles' && (
          <>
            {league.isAdmin && members.length >= 2 && (
              <LeaguePairShuffle
                leagueId={league.id}
                memberNames={members.map(m => m.displayName)}
                disabled={busy}
                onComplete={(result: ShuffleLeaguePairsResult) => {
                  setPairs(result.pairs)
                  setShuffleSitOut(result.sitOutName)
                  setJustShuffled(true)
                  void fetchLeaguePairStandings(league.id)
                    .then(setPairStandings)
                    .catch(() => setPairStandings([]))
                  void onRefreshStandings()
                }}
                onError={onError}
              />
            )}

            {(pairs.length > 0 || shuffleSitOut) && (
              <LeaguePairReveal
                pairs={pairs}
                sitOutName={shuffleSitOut}
                justRevealed={justShuffled}
              />
            )}

            {pairs.length === 0 ? (
              <p className="muted">No pairs yet — shuffle teams above or create pairs manually.</p>
            ) : (
              <ul className="league-pair-list">
                {pairs.map(p => {
                  const onTeam =
                    user?.id === p.player1Id || user?.id === p.player2Id
                  return (
                    <li key={p.id} className="league-pair-item">
                      <div>
                        <div className="league-pair-title-row">
                          <strong>{p.name ?? `${p.player1Name} & ${p.player2Name}`}</strong>
                          {livePairIds.has(p.id) && (
                            <span className="league-live-badge">Live now</span>
                          )}
                        </div>
                        <p className="muted small">
                          {p.player1Name} · {p.player2Name}
                        </p>
                      </div>
                      <div className="league-pair-item-actions">
                        {onTeam && (
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={busy}
                            onClick={() => setStartRoundPair(p)}
                          >
                            Start live round
                          </button>
                        )}
                        {league.isAdmin && (
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={busy}
                            onClick={() => handleDeletePair(p.id)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {league.isAdmin && members.length >= 2 && (
              <form onSubmit={handleCreatePair} className="league-inline-form">
                <div className="league-form-row">
                  <label>
                    Player 1
                    <select
                      value={pairPlayer1}
                      onChange={e => setPairPlayer1(e.target.value)}
                      required
                    >
                      <option value="">Select…</option>
                      {members.map(m => (
                        <option key={m.userId} value={m.userId}>
                          {m.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Player 2
                    <select
                      value={pairPlayer2}
                      onChange={e => setPairPlayer2(e.target.value)}
                      required
                    >
                      <option value="">Select…</option>
                      {members.map(m => (
                        <option key={m.userId} value={m.userId}>
                          {m.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <input
                  value={pairName}
                  onChange={e => setPairName(e.target.value)}
                  placeholder="Team name (optional)"
                  maxLength={80}
                />
                <button type="submit" className="btn-primary" disabled={busy}>
                  Create pair
                </button>
              </form>
            )}
          </>
        )}

        {startRoundPair && (
          <LeaguePairRoundModal
            pair={startRoundPair}
            isPro={isPro}
            onClose={() => setStartRoundPair(null)}
            onError={onError}
          />
        )}

        {tab === 'rivalries' && (
          <>
            {streaks.length > 0 && (
              <>
                <h4>Active players</h4>
                <ul className="league-streak-list">
                  {streaks.map(s => (
                    <li key={s.userId}>
                      <strong>{s.displayName}</strong> — {s.submittedRounds} rounds
                      {s.avgScoreToPar != null && (
                        <span className="muted small">
                          {' '}
                          · avg {formatScoreToPar(s.avgScoreToPar)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {rivalries.length === 0 ? (
              <p className="muted">
                No head-to-head rivalries yet — play shared rounds to build records.
              </p>
            ) : (
              <>
                <h4>Head-to-head</h4>
                <ul className="league-rivalry-list">
                  {rivalries.map(r => (
                    <li key={`${r.userAId}-${r.userBId}`} className="league-rivalry-item">
                      <strong>
                        {r.userAName} vs {r.userBName}
                      </strong>
                      <p className="muted small">
                        {r.sharedRounds} shared rounds · {r.userAName} {r.aWins}–{r.bWins}{' '}
                        {r.userBName}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
