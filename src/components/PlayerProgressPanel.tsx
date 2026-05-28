import { useEffect, useState } from 'react'
import { formatScoreToPar } from '../lib/rounds'
import { fetchPlayerStatsSummary, listPlayerBadges, refreshProgression } from '../lib/progression'
import { PlayerBadge, PlayerStatsSummary } from '../types'

export function PlayerProgressPanel() {
  const [stats, setStats] = useState<PlayerStatsSummary | null>(null)
  const [badges, setBadges] = useState<PlayerBadge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    refreshProgression()
      .then(() =>
        Promise.all([fetchPlayerStatsSummary(), listPlayerBadges()]),
      )
      .then(([s, b]) => {
        if (!mounted) return
        setStats(s)
        setBadges(b)
      })
      .catch(() => {
        if (!mounted) return
        setStats(null)
        setBadges([])
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className="card player-progress">
        <h2>Progress</h2>
        <p className="muted small">Loading…</p>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="card player-progress">
      <h2>Progress</h2>
      <p className="muted small">
        Lifetime stats and badges earned from rounds, leagues, and challenges.
      </p>

      <dl className="player-progress-stats">
        <div>
          <dt>Rounds</dt>
          <dd>{stats.roundsCompleted}</dd>
        </div>
        <div>
          <dt>Birdies</dt>
          <dd>{stats.birdies}</dd>
        </div>
        <div>
          <dt>Best</dt>
          <dd>
            {stats.bestScoreToPar != null ? formatScoreToPar(stats.bestScoreToPar) : '—'}
          </dd>
        </div>
        <div>
          <dt>Leagues</dt>
          <dd>{stats.leagueCount}</dd>
        </div>
        <div>
          <dt>League rounds</dt>
          <dd>{stats.leagueRounds}</dd>
        </div>
        <div>
          <dt>Active days (7d)</dt>
          <dd>{stats.activeDaysLast7}</dd>
        </div>
      </dl>

      {badges.length === 0 ? (
        <p className="muted small">Play rounds and join leagues to earn badges.</p>
      ) : (
        <>
          <h3 className="player-progress-badges-title">Badges</h3>
          <ul className="player-badge-grid">
            {badges.map(b => (
              <li key={b.slug} className="player-badge-item" title={b.description}>
                <span className="player-badge-icon" aria-hidden>
                  {b.icon}
                </span>
                <div>
                  <strong>{b.title}</strong>
                  <p className="muted small">{b.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
