import { useEffect, useRef, useState } from 'react'
import { shuffleLeaguePairs } from '../lib/leagues'
import { LeaguePair, ShuffleLeaguePairsResult } from '../types'

const SPIN_MS = 2200
const TICK_MS = 90

interface Props {
  leagueId: string
  memberNames: string[]
  disabled?: boolean
  onComplete: (result: ShuffleLeaguePairsResult) => void
  onError: (message: string) => void
}

export function LeaguePairShuffle({
  leagueId,
  memberNames,
  disabled,
  onComplete,
  onError,
}: Props) {
  const [spinning, setSpinning] = useState(false)
  const [flashName, setFlashName] = useState<string | null>(null)
  const tickRef = useRef<number | null>(null)
  const finishRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (tickRef.current != null) window.clearInterval(tickRef.current)
      if (finishRef.current != null) window.clearTimeout(finishRef.current)
    }
  }, [])

  async function handleShuffle() {
    if (spinning || disabled || memberNames.length < 2) return
    onError('')
    setSpinning(true)

    let tick = 0
    tickRef.current = window.setInterval(() => {
      const name = memberNames[tick % memberNames.length]
      setFlashName(name ?? 'Drawing teams…')
      tick += 1
    }, TICK_MS)

    finishRef.current = window.setTimeout(async () => {
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current)
        tickRef.current = null
      }
      try {
        const result = await shuffleLeaguePairs(leagueId)
        setFlashName('Teams locked in!')
        onComplete(result)
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Could not shuffle pairs')
      } finally {
        setSpinning(false)
        finishRef.current = null
      }
    }, SPIN_MS)
  }

  return (
    <div className="league-shuffle-panel">
      <div className="league-shuffle-copy">
        <h4>Pairing draw</h4>
        <p className="muted small">
          Shuffle everyone into random doubles teams for league night. Existing pairs are replaced.
        </p>
      </div>
      <div className={`league-shuffle-stage${spinning ? ' league-shuffle-stage-active' : ''}`}>
        {spinning ? (
          <>
            <span className="league-shuffle-label">Drawing…</span>
            <strong className="league-shuffle-name">{flashName}</strong>
          </>
        ) : (
          <span className="muted small">Tap shuffle to spin the draw</span>
        )}
      </div>
      <button
        type="button"
        className="btn-primary league-shuffle-btn"
        disabled={disabled || spinning || memberNames.length < 2}
        onClick={() => void handleShuffle()}
      >
        {spinning ? 'Shuffling…' : 'Shuffle teams'}
      </button>
    </div>
  )
}

export function LeaguePairReveal({
  pairs,
  sitOutName,
  justRevealed,
}: {
  pairs: LeaguePair[]
  sitOutName?: string | null
  justRevealed?: boolean
}) {
  if (pairs.length === 0) return null

  return (
    <div className={`league-pair-reveal${justRevealed ? ' league-pair-reveal-fresh' : ''}`}>
      <h4>Tonight&apos;s teams</h4>
      <ul className="league-pair-reveal-list">
        {pairs.map((p, idx) => (
          <li
            key={p.id}
            className="league-pair-reveal-item"
            style={{ animationDelay: `${idx * 120}ms` }}
          >
            <span className="league-pair-reveal-team">{p.name ?? 'Team'}</span>
            <span>
              {p.player1Name} <span className="muted">&</span> {p.player2Name}
            </span>
          </li>
        ))}
      </ul>
      {sitOutName && (
        <p className="muted small league-pair-sit-out">
          Odd player out this draw: <strong>{sitOutName}</strong>
        </p>
      )}
    </div>
  )
}
