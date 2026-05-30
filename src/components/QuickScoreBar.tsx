import { useCallback, useEffect, useMemo, useState } from 'react'
import { CourseHole, RoundPlayer, RoundScore } from '../types'
import { formatScoreToPar, upsertHoleScore } from '../lib/rounds'
import { fetchRoundHostScoringOnly } from '../lib/roundInvites'
import { isOnline, queueOfflineScore } from '../lib/offlineRound'

const COLLAPSED_KEY = 'disc-caddy-quick-score-collapsed'

interface Props {
  roundId: string
  players: RoundPlayer[]
  scores: RoundScore[]
  holes: CourseHole[]
  currentHoleNumber: number
  currentUserId: string
  isHost: boolean
  onScoresChange: () => void | Promise<void>
  onOptimisticScore?: (score: {
    roundPlayerId: string
    holeNumber: number
    strokes: number
    putts: number | null
    par: number | null
  }) => void
}

export function QuickScoreBar({
  roundId,
  players,
  scores,
  holes,
  currentHoleNumber,
  currentUserId,
  isHost,
  onScoresChange,
  onOptimisticScore,
}: Props) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })
  const [hostScoringOnly, setHostScoringOnly] = useState(false)
  const [activePlayerIdx, setActivePlayerIdx] = useState(0)
  const [busy, setBusy] = useState(false)

  const currentHole = holes.find(h => h.number === currentHoleNumber) ?? null
  const par = currentHole?.par ?? null

  useEffect(() => {
    fetchRoundHostScoringOnly(roundId)
      .then(setHostScoringOnly)
      .catch(() => setHostScoringOnly(false))
  }, [roundId])

  useEffect(() => {
    setActivePlayerIdx(0)
  }, [currentHoleNumber, players.length])

  const editablePlayers = useMemo(
    () =>
      players.filter(p => {
        if (hostScoringOnly) return isHost
        return isHost || p.userId === currentUserId
      }),
    [players, hostScoringOnly, isHost, currentUserId],
  )

  const activePlayer = editablePlayers[activePlayerIdx] ?? editablePlayers[0] ?? null

  const holeScore = useMemo(() => {
    if (!activePlayer) return null
    return (
      scores.find(
        s => s.roundPlayerId === activePlayer.id && s.holeNumber === currentHoleNumber,
      ) ?? null
    )
  }, [scores, activePlayer, currentHoleNumber])

  const strokes = holeScore?.strokes ?? null
  const toPar =
    strokes != null && par != null ? formatScoreToPar(strokes - par) : null

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  const persistScore = useCallback(
    async (player: RoundPlayer, nextStrokes: number) => {
      const payload = {
        roundId,
        roundPlayerId: player.id,
        holeNumber: currentHoleNumber,
        strokes: nextStrokes,
        putts: holeScore?.putts ?? null,
        par,
      }

      if (!isOnline()) {
        queueOfflineScore({
          roundId,
          roundPlayerId: player.id,
          holeNumber: currentHoleNumber,
          strokes: nextStrokes,
          putts: holeScore?.putts ?? null,
          par,
        })
        onOptimisticScore?.({
          roundPlayerId: player.id,
          holeNumber: currentHoleNumber,
          strokes: nextStrokes,
          putts: holeScore?.putts ?? null,
          par,
        })
        return
      }

      await upsertHoleScore(payload)
      await onScoresChange()
    },
    [roundId, currentHoleNumber, holeScore?.putts, par, onOptimisticScore, onScoresChange],
  )

  async function changeStrokes(delta: number) {
    if (!activePlayer || busy) return
    const basePar = par ?? 3
    let next: number
    if (strokes == null) {
      next = delta > 0 ? basePar : Math.max(1, basePar - 1)
    } else {
      next = strokes + delta
    }
    next = Math.min(20, Math.max(1, next))
    setBusy(true)
    try {
      await persistScore(activePlayer, next)
    } catch (err) {
      console.error('[quick-score] save failed', err)
    } finally {
      setBusy(false)
    }
  }

  function cyclePlayer(dir: -1 | 1) {
    if (editablePlayers.length <= 1) return
    setActivePlayerIdx(i => {
      const next = i + dir
      if (next < 0) return editablePlayers.length - 1
      if (next >= editablePlayers.length) return 0
      return next
    })
  }

  if (editablePlayers.length === 0) return null

  return (
    <div
      className={`quick-score-bar${collapsed ? ' quick-score-bar--collapsed' : ''}`}
      aria-label="Quick score entry"
    >
      <button
        type="button"
        className="quick-score-toggle"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
      >
        {collapsed ? 'Score' : 'Hide'}
        {!collapsed && strokes != null && (
          <span className="quick-score-toggle-meta">
            H{currentHoleNumber}: {strokes}
            {toPar ? ` (${toPar})` : ''}
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="quick-score-body">
          <div className="quick-score-context">
            <span className="quick-score-hole">Hole {currentHoleNumber}</span>
            {par != null && <span className="quick-score-par muted small">Par {par}</span>}
          </div>

          {editablePlayers.length > 1 && (
            <div className="quick-score-player-row">
              <button
                type="button"
                className="quick-score-player-nav"
                onClick={() => cyclePlayer(-1)}
                aria-label="Previous player"
              >
                ‹
              </button>
              <span className="quick-score-player-name">{activePlayer?.displayName}</span>
              <button
                type="button"
                className="quick-score-player-nav"
                onClick={() => cyclePlayer(1)}
                aria-label="Next player"
              >
                ›
              </button>
            </div>
          )}

          <div className="quick-score-controls">
            <button
              type="button"
              className="quick-score-step"
              onClick={() => void changeStrokes(-1)}
              disabled={busy}
              aria-label="Remove stroke"
            >
              −
            </button>
            <div className="quick-score-display">
              <strong className="quick-score-strokes">{strokes ?? '—'}</strong>
              {toPar && <span className="quick-score-to-par">{toPar}</span>}
            </div>
            <button
              type="button"
              className="quick-score-step"
              onClick={() => void changeStrokes(1)}
              disabled={busy}
              aria-label="Add stroke"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
