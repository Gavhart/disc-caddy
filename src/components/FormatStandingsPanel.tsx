import { useEffect, useState } from 'react'
import { fetchFormatStandings, FORMAT_LABELS } from '../lib/roundFormats'
import { FormatStandings, RoundFormat } from '../types'

interface Props {
  roundId: string
  format: RoundFormat
}

export function FormatStandingsPanel({ roundId, format }: Props) {
  const [standings, setStandings] = useState<FormatStandings | null>(null)

  useEffect(() => {
    fetchFormatStandings(roundId)
      .then(setStandings)
      .catch(() => setStandings(null))
  }, [roundId, format])

  if (!standings || standings.standings.length === 0) return null

  return (
    <div className="scorecard-format-standings">
      <span className="muted small">
        {FORMAT_LABELS[standings.format]} standings
      </span>
      <div className="scorecard-hole-rank-list">
        {standings.standings.map(s => (
          <span key={s.playerId ?? s.teamId ?? s.displayName} className="pill small">
            #{s.rank} {s.displayName} ({s.displayScore} {s.unit})
          </span>
        ))}
      </div>
    </div>
  )
}
