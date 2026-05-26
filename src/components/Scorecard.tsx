import { useEffect, useMemo, useState } from 'react'
import { CourseHole, RoundPlayer, RoundScore } from '../types'
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
    () =>
      friends.filter(
        f => !players.some(p => p.userId === f.userId),
      ),
    [friends, players],
  )

  useEffect(() => {
    if (!addOpen || !isHost) return
    listFriends()
      .then(setFriends)
      .catch(err => console.error('[scorecard] friends load failed', err))
  }, [addOpen, isHost])

  function canEditPlayer(player: RoundPlayer): boolean {
    return isHost || player.userId === currentUserId
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

  async function handleAddRegistered(userId: string, displayName: string) {
    setBusy(true)
    setError(null)
    try {
      await addRoundPlayer({ roundId, userId, displayName })
      await onPlayersChange()
      setAddOpen(false)
      setQuery('')
      setSearchResults([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add player')
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
    const next = Math.min(20, Math.max(1, (existing?.strokes ?? par ?? 3) + delta))
    setBusy(true)
    try {
      await upsertHoleScore({
        roundId,
        roundPlayerId: player.id,
        holeNumber: currentHoleNumber,
        strokes: next,
        putts: existing?.putts ?? null,
        par,
      })
      await onScoresChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save score')
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

      {error && <div className="form-error small">{error}</div>}

      {addOpen && isHost && (
        <div className="scorecard-add-panel">
          {availableFriends.length > 0 && (
            <div className="scorecard-friends-quick">
              <span className="muted small">Add a friend</span>
              <div className="scorecard-friends-chips">
                {availableFriends.map(friend => (
                  <button
                    key={friend.userId}
                    type="button"
                    className="btn-secondary scorecard-friend-chip"
                    disabled={busy}
                    onClick={() =>
                      handleAddRegistered(friend.userId, friend.displayName)
                    }
                  >
                    + {friend.displayName.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label>
            <span className="muted small">Find a Disc Caddy user (email or name)</span>
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
                    onClick={() => handleAddRegistered(r.userId, r.displayName)}
                    disabled={busy}
                  >
                    {r.displayName}
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
                  <span className="scorecard-strokes">
                    {score?.strokes ?? '—'}
                  </span>
                  <button
                    type="button"
                    className="btn-icon scorecard-step"
                    onClick={() => changeStrokes(player, 1)}
                    disabled={!editable || busy}
                    aria-label="More strokes"
                  >
                    +
                  </button>
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
