import { useEffect, useMemo, useState } from 'react'
import { CourseHole, RoundFormat, RoundPlayer, RoundScore } from '../types'
import {
  addRoundPlayer,
  computePlayerTotals,
  formatScoreToPar,
  rankPlayersOnHole,
  removeRoundPlayer,
  searchPlayers,
  upsertHoleScore,
} from '../lib/rounds'
import { listFriends } from '../lib/friends'
import {
  fetchRoundHostScoringOnly,
  invitePlayerToRound,
  setRoundHostScoringOnly,
} from '../lib/roundInvites'
import {
  FORMAT_LABELS,
  setRoundFormat,
  createRoundTeam,
  assignPlayerTeam,
} from '../lib/roundFormats'
import { FormatStandingsPanel } from './FormatStandingsPanel'
import {
  isOnline,
  queueOfflineScore,
} from '../lib/offlineRound'
import { Friend } from '../types'

interface Props {
  roundId: string
  players: RoundPlayer[]
  scores: RoundScore[]
  holes: CourseHole[]
  currentHoleNumber: number | null
  currentUserId: string
  isHost: boolean
  onPlayersChange: () => void | Promise<void>
  onScoresChange: () => void | Promise<void>
  onOptimisticScore?: (score: {
    roundPlayerId: string
    holeNumber: number
    strokes: number
    putts: number | null
    par: number | null
  }) => void
  roundFormat?: RoundFormat
  onFormatChange?: () => void | Promise<void>
}

export function Scorecard({
  roundId,
  players,
  scores,
  holes,
  currentHoleNumber,
  currentUserId,
  isHost,
  onPlayersChange,
  onScoresChange,
  onOptimisticScore,
  roundFormat = 'stroke',
  onFormatChange,
}: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [guestName, setGuestName] = useState('')
  const [searchResults, setSearchResults] = useState<
    Awaited<ReturnType<typeof searchPlayers>>
  >([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [hostScoringOnly, setHostScoringOnlyState] = useState(false)
  const [typingPlayerId, setTypingPlayerId] = useState<string | null>(null)
  const [typedScore, setTypedScore] = useState('')

  const currentHole = holes.find(h => h.number === currentHoleNumber) ?? null
  const par = currentHole?.par ?? null

  const totals = useMemo(
    () => computePlayerTotals(players, scores),
    [players, scores],
  )

  const holeRanks = useMemo(() => {
    if (currentHoleNumber == null) return []
    return rankPlayersOnHole(players, scores, currentHoleNumber)
  }, [players, scores, currentHoleNumber])

  const sortedHoles = useMemo(
    () => [...holes].sort((a, b) => a.number - b.number),
    [holes],
  )

  const availableFriends = useMemo(
    () => friends.filter(f => !players.some(p => p.userId === f.userId)),
    [friends, players],
  )

  useEffect(() => {
    if (!isHost) return
    fetchRoundHostScoringOnly(roundId)
      .then(setHostScoringOnlyState)
      .catch(() => setHostScoringOnlyState(false))
  }, [roundId, isHost])

  useEffect(() => {
    if (!addOpen || !isHost) return
    listFriends()
      .then(setFriends)
      .catch(err => console.error('[scorecard] friends load failed', err))
  }, [addOpen, isHost])

  function canEditPlayer(player: RoundPlayer): boolean {
    if (hostScoringOnly) return isHost
    return isHost || player.userId === currentUserId
  }

  async function persistScore(
    player: RoundPlayer,
    strokes: number,
    putts: number | null,
  ) {
    if (currentHoleNumber == null) return
    const payload = {
      roundId,
      roundPlayerId: player.id,
      holeNumber: currentHoleNumber,
      strokes,
      putts,
      par,
    }

    if (!isOnline()) {
      queueOfflineScore({
        roundId,
        roundPlayerId: player.id,
        holeNumber: currentHoleNumber,
        strokes,
        putts,
        par,
      })
      onOptimisticScore?.({
        roundPlayerId: player.id,
        holeNumber: currentHoleNumber,
        strokes,
        putts,
        par,
      })
      return
    }

    await upsertHoleScore(payload)
    await onScoresChange()
  }

  async function handleSearch(q: string) {
    setQuery(q)
    if (q.trim().length < 2) {
      setSearchResults([])
      return
    }
    try {
      setSearchResults(await searchPlayers(q))
    } catch (err) {
      console.error('[scorecard] search failed', err)
    }
  }

  async function handleInviteRegistered(userId: string, displayName: string) {
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      await invitePlayerToRound(roundId, userId)
      setInfo(`Invite sent to ${displayName}. They'll join after accepting.`)
      setAddOpen(false)
      setQuery('')
      setSearchResults([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send invite')
    } finally {
      setBusy(false)
    }
  }

  async function handleAddGuest() {
    const name = guestName.trim()
    if (!name) return
    setBusy(true)
    setError(null)
    try {
      await addRoundPlayer({ roundId, displayName: name })
      await onPlayersChange()
      setGuestName('')
      setAddOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add player')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(player: RoundPlayer) {
    if (player.isHost) return
    if (!confirm(`Remove ${player.displayName} from the card?`)) return
    setBusy(true)
    try {
      await removeRoundPlayer(player.id)
      await onPlayersChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove player')
    } finally {
      setBusy(false)
    }
  }

  async function changeStrokes(player: RoundPlayer, delta: number) {
    if (currentHoleNumber == null || !canEditPlayer(player)) return
    const existing = scores.find(
      s => s.roundPlayerId === player.id && s.holeNumber === currentHoleNumber,
    )
    const basePar = par ?? 3
    let next: number
    if (!existing) {
      next = delta > 0 ? basePar : Math.max(1, basePar - 1)
    } else {
      next = existing.strokes + delta
    }
    next = Math.min(20, Math.max(1, next))
    setBusy(true)
    try {
      await persistScore(player, next, existing?.putts ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save score')
    } finally {
      setBusy(false)
    }
  }

  async function changePutts(player: RoundPlayer, delta: number) {
    if (currentHoleNumber == null || !canEditPlayer(player)) return
    const existing = scores.find(
      s => s.roundPlayerId === player.id && s.holeNumber === currentHoleNumber,
    )
    const strokes = existing?.strokes ?? par ?? 3
    const currentPutts = existing?.putts ?? 0
    const next = Math.min(strokes, Math.max(0, currentPutts + delta))
    setBusy(true)
    try {
      await persistScore(player, strokes, next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save putts')
    } finally {
      setBusy(false)
    }
  }

  function startTyping(player: RoundPlayer) {
    if (!canEditPlayer(player)) return
    const existing = scores.find(
      s => s.roundPlayerId === player.id && s.holeNumber === currentHoleNumber,
    )
    setTypingPlayerId(player.id)
    setTypedScore(existing?.strokes != null ? String(existing.strokes) : '')
  }

  async function commitTypedScore(player: RoundPlayer) {
    const parsed = Number(typedScore)
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 20) {
      setError('Enter a score between 1 and 20')
      return
    }
    const existing = scores.find(
      s => s.roundPlayerId === player.id && s.holeNumber === currentHoleNumber,
    )
    setTypingPlayerId(null)
    setBusy(true)
    try {
      await persistScore(player, parsed, existing?.putts ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save score')
    } finally {
      setBusy(false)
    }
  }

  async function toggleHostScoringOnly() {
    if (!isHost) return
    const next = !hostScoringOnly
    setBusy(true)
    try {
      await setRoundHostScoringOnly(roundId, next)
      setHostScoringOnlyState(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update scoring mode')
    } finally {
      setBusy(false)
    }
  }

  async function handleFormatChange(format: RoundFormat) {
    if (!isHost) return
    setBusy(true)
    try {
      await setRoundFormat(roundId, format)
      if (format === 'best_ball' && players.length >= 2) {
        const teamId = await createRoundTeam(roundId, 'Team 1')
        await assignPlayerTeam(players[0].id, teamId)
        if (players[1]) {
          const team2 = await createRoundTeam(roundId, 'Team 2')
          await assignPlayerTeam(players[1].id, team2)
        }
      }
      await onFormatChange?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set format')
    } finally {
      setBusy(false)
    }
  }

  if (currentHoleNumber == null) return null

  return (
    <section className="card scorecard">
      <div className="card-header">
        <h2>Scorecard</h2>
        {!isHost && (
          <span className="pill small scorecard-guest-pill">Group card</span>
        )}
        {isHost && (
          <button
            type="button"
            className="btn-secondary scorecard-add-btn"
            onClick={() => setAddOpen(v => !v)}
            disabled={busy}
          >
            + Player
          </button>
        )}
      </div>

      {hostScoringOnly && !isHost && (
        <p className="muted small scorecard-host-only-note">
          Host is entering scores for everyone on this card.
        </p>
      )}

      {isHost && players.length > 1 && (
        <label className="scorecard-host-only-toggle">
          <input
            type="checkbox"
            checked={hostScoringOnly}
            onChange={toggleHostScoringOnly}
            disabled={busy}
          />
          <span>Host enters all scores (one phone)</span>
        </label>
      )}

      {isHost && (
        <label className="scorecard-format-pick">
          <span className="muted small">Format</span>
          <select
            value={roundFormat}
            disabled={busy}
            onChange={e => handleFormatChange(e.target.value as RoundFormat)}
          >
            {(Object.keys(FORMAT_LABELS) as RoundFormat[]).map(f => (
              <option key={f} value={f}>
                {FORMAT_LABELS[f]}
              </option>
            ))}
          </select>
        </label>
      )}

      <FormatStandingsPanel roundId={roundId} format={roundFormat} />

      {error && <div className="form-error small">{error}</div>}
      {info && <div className="form-success small">{info}</div>}

      {addOpen && isHost && (
        <div className="scorecard-add-panel">
          {availableFriends.length > 0 && (
            <div className="scorecard-friends-quick">
              <span className="muted small">Invite a friend</span>
              <div className="scorecard-friends-chips">
                {availableFriends.map(friend => (
                  <button
                    key={friend.userId}
                    type="button"
                    className="btn-secondary scorecard-friend-chip"
                    disabled={busy}
                    onClick={() =>
                      handleInviteRegistered(friend.userId, friend.displayName)
                    }
                  >
                    + {friend.displayName.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label>
            <span className="muted small">
              Invite a Disc Caddy user (email or name)
            </span>
            <input
              type="text"
              value={query}
              onChange={e => handleSearch(e.target.value)}
              placeholder="name or email@…"
              disabled={busy}
            />
          </label>
          {searchResults.length > 0 && (
            <ul className="scorecard-search-results">
              {searchResults.map(r => (
                <li key={r.userId}>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => handleInviteRegistered(r.userId, r.displayName)}
                    disabled={busy}
                  >
                    Invite {r.displayName}
                    <span className="muted small"> · {r.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="scorecard-guest-row">
            <input
              type="text"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              placeholder="Or add guest name"
              disabled={busy}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={handleAddGuest}
              disabled={busy || !guestName.trim()}
            >
              Add guest
            </button>
          </div>
        </div>
      )}

      {holeRanks.length > 1 && (
        <div className="scorecard-hole-rank">
          <span className="muted small">Hole {currentHoleNumber} standings</span>
          <div className="scorecard-hole-rank-list">
            {holeRanks.map(r => (
              <span key={r.player.id} className="pill small">
                #{r.rank} {r.player.displayName} ({r.strokes})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="scorecard-current">
        <div className="scorecard-current-label">
          Hole {currentHoleNumber}
          {par != null && <span className="muted"> · par {par}</span>}
        </div>
        <div className="scorecard-rows">
          {players.map(player => {
            const score = scores.find(
              s =>
                s.roundPlayerId === player.id &&
                s.holeNumber === currentHoleNumber,
            )
            const total = totals.get(player.id)
            const editable = canEditPlayer(player)
            const typing = typingPlayerId === player.id
            return (
              <div key={player.id} className="scorecard-row">
                <div className="scorecard-player">
                  <strong>{player.displayName}</strong>
                  {player.isHost && (
                    <span className="pill small scorecard-host-pill">Host</span>
                  )}
                  {total && total.holes > 0 && (
                    <span className="muted small scorecard-running">
                      {total.strokes}
                      {total.par > 0 && (
                        <> ({formatScoreToPar(total.scoreToPar)})</>
                      )}
                    </span>
                  )}
                </div>
                <div className="scorecard-controls">
                  <button
                    type="button"
                    className="btn-icon scorecard-step"
                    onClick={() => changeStrokes(player, -1)}
                    disabled={!editable || busy || (score?.strokes ?? 0) <= 1}
                    aria-label="Fewer strokes"
                  >
                    −
                  </button>
                  {typing ? (
                    <input
                      type="number"
                      min={1}
                      max={20}
                      className="scorecard-strokes-input"
                      value={typedScore}
                      autoFocus
                      onChange={e => setTypedScore(e.target.value)}
                      onBlur={() => commitTypedScore(player)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitTypedScore(player)
                        if (e.key === 'Escape') setTypingPlayerId(null)
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="scorecard-strokes scorecard-strokes-tap"
                      onClick={() => startTyping(player)}
                      disabled={!editable || busy}
                      title="Tap to type score"
                    >
                      {score?.strokes ?? '—'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-icon scorecard-step"
                    onClick={() => changeStrokes(player, 1)}
                    disabled={!editable || busy}
                    aria-label="More strokes"
                  >
                    +
                  </button>
                  <div className="scorecard-putts">
                    <span className="muted small">Putts</span>
                    <button
                      type="button"
                      className="btn-icon scorecard-step scorecard-putt-step"
                      onClick={() => changePutts(player, -1)}
                      disabled={
                        !editable || busy || (score?.putts ?? 0) <= 0
                      }
                      aria-label="Fewer putts"
                    >
                      −
                    </button>
                    <span className="scorecard-putts-value">
                      {score?.putts ?? '—'}
                    </span>
                    <button
                      type="button"
                      className="btn-icon scorecard-step scorecard-putt-step"
                      onClick={() => changePutts(player, 1)}
                      disabled={!editable || busy}
                      aria-label="More putts"
                    >
                      +
                    </button>
                  </div>
                  {isHost && !player.isHost && (
                    <button
                      type="button"
                      className="link-button danger scorecard-remove"
                      onClick={() => handleRemove(player)}
                      disabled={busy}
                      title="Remove player"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {sortedHoles.length > 0 && players.length > 0 && (
        <details className="scorecard-grid-wrap">
          <summary>Full card</summary>
          <div className="scorecard-grid-scroll">
            <table className="scorecard-grid">
              <thead>
                <tr>
                  <th>Player</th>
                  {sortedHoles.map(h => (
                    <th key={h.id}>#{h.number}</th>
                  ))}
                  <th>Tot</th>
                </tr>
              </thead>
              <tbody>
                {players.map(player => {
                  const total = totals.get(player.id)
                  return (
                    <tr key={player.id}>
                      <td>{player.displayName}</td>
                      {sortedHoles.map(h => {
                        const s = scores.find(
                          sc =>
                            sc.roundPlayerId === player.id &&
                            sc.holeNumber === h.number,
                        )
                        const active = h.number === currentHoleNumber
                        return (
                          <td
                            key={h.id}
                            className={active ? 'scorecard-cell-active' : undefined}
                          >
                            {s?.strokes ?? '·'}
                          </td>
                        )
                      })}
                      <td>
                        <strong>{total?.strokes ?? '—'}</strong>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  )
}
