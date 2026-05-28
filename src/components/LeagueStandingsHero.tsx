import { formatScoreToPar } from '../lib/rounds'
import { League, LeaguePairStanding, LeagueStanding } from '../types'

function podiumClass(rank: number): string {
  if (rank === 1) return 'league-podium-first'
  if (rank === 2) return 'league-podium-second'
  if (rank === 3) return 'league-podium-third'
  return ''
}

function formatStandingScore(league: League, row: LeagueStanding): string {
  if (league.format === 'stableford') {
    return row.avgStablefordPoints != null ? `${row.avgStablefordPoints} pts` : '—'
  }
  if (league.handicapEnabled && row.avgNetScoreToPar != null) {
    return formatScoreToPar(row.avgNetScoreToPar)
  }
  return row.avgScoreToPar != null ? formatScoreToPar(row.avgScoreToPar) : '—'
}

export function LeagueStandingsHero({
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
  if (league.playMode === 'doubles' && pairStandings.length > 0) {
    const top = pairStandings.slice(0, 3)
    const myPair = myPairStanding

    return (
      <div className="league-standings-hero">
        <h4>Leaderboard</h4>
        <div className="league-podium">
          {[1, 0, 2].map(idx => {
            const row = top[idx]
            if (!row) {
              return (
                <div
                  key={`empty-${idx}`}
                  className={`league-podium-slot league-podium-empty ${idx === 0 ? 'league-podium-first' : idx === 1 ? 'league-podium-second' : 'league-podium-third'}`}
                />
              )
            }
            return (
              <div
                key={row.pairId}
                className={`league-podium-slot ${podiumClass(row.rank)}`}
              >
                <span className="league-podium-rank">#{row.rank}</span>
                <strong className="league-podium-name">{row.pairName}</strong>
                <span className="league-podium-score muted small">
                  {row.avgCombinedToPar != null
                    ? formatScoreToPar(row.avgCombinedToPar)
                    : '—'}{' '}
                  avg
                </span>
                <span className="muted small">{row.roundsTogether} rounds</span>
              </div>
            )
          })}
        </div>
        {myPair && (
          <p className="league-hero-you muted small">
            Your team <strong>{myPair.pairName}</strong> — #{myPair.rank}
            {myPair.avgCombinedToPar != null &&
              ` · ${formatScoreToPar(myPair.avgCombinedToPar)} avg`}
          </p>
        )}
      </div>
    )
  }

  if (standings.length === 0) return null

  const top = standings.slice(0, 3)
  const me = standings.find(s => s.userId === currentUserId)

  return (
    <div className="league-standings-hero">
      <h4>Leaderboard</h4>
      <div className="league-podium">
        {[1, 0, 2].map(idx => {
          const row = top[idx]
          if (!row) {
            return (
              <div
                key={`empty-${idx}`}
                className={`league-podium-slot league-podium-empty ${idx === 0 ? 'league-podium-first' : idx === 1 ? 'league-podium-second' : 'league-podium-third'}`}
              />
            )
          }
          const isYou = row.userId === currentUserId
          return (
            <div
              key={row.userId}
              className={`league-podium-slot ${podiumClass(row.rank)}${isYou ? ' league-podium-you' : ''}`}
            >
              <span className="league-podium-rank">#{row.rank}</span>
              <strong className="league-podium-name">
                {row.displayName}
                {isYou ? ' (you)' : ''}
              </strong>
              <span className="league-podium-score muted small">
                {formatStandingScore(league, row)}
              </span>
              <span className="muted small">{row.roundsSubmitted} rounds</span>
            </div>
          )
        })}
      </div>
      {me && me.rank > 3 && (
        <p className="league-hero-you muted small">
          You&apos;re <strong>#{me.rank}</strong> — {formatStandingScore(league, me)} ·{' '}
          {me.roundsSubmitted} rounds
        </p>
      )}
    </div>
  )
}
