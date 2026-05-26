import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ProGate } from '../components/ProGate'
import { fetchDiscPerformanceStats, fetchPlayerStatsDashboard } from '../lib/stats'
import { formatScoreToPar } from '../lib/rounds'
import { DiscPerformanceStat, PlayerStatsDashboard } from '../types'

export function StatsPage() {
  const { me } = useAuth()
  const [stats, setStats] = useState<PlayerStatsDashboard | null>(null)
  const [discs, setDiscs] = useState<DiscPerformanceStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!me?.isPro) {
      setLoading(false)
      return
    }
    Promise.all([fetchPlayerStatsDashboard(), fetchDiscPerformanceStats()])
      .then(([s, d]) => {
        setStats(s)
        setDiscs(d)
      })
      .catch(err =>
        setError(err instanceof Error ? err.message : 'Could not load stats'),
      )
      .finally(() => setLoading(false))
  }, [me?.isPro])

  if (!me?.isPro) {
    return (
      <div className="container">
        <div className="card">
          <h2>Player stats</h2>
          <ProGate feature="Player stats dashboard">
            See scoring trends, birdie counts, and which discs perform best for you.
          </ProGate>
          <Link to="/upgrade" className="btn-primary" style={{ marginTop: 12 }}>
            Upgrade to Pro
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container stats-page">
      <div className="card">
        <h2>Player stats</h2>
        <p className="muted small">From your completed rounds on Disc Caddy.</p>
        {loading && <p className="muted">Loading…</p>}
        {error && <div className="form-error">{error}</div>}
        {stats && (
          <div className="stats-grid">
            <div className="profile-stat">
              <span className="profile-stat-value">{stats.roundsPlayed}</span>
              <span className="profile-stat-label">Rounds (9+ holes)</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-value">
                {stats.avgScoreToPar != null ? formatScoreToPar(stats.avgScoreToPar) : '—'}
              </span>
              <span className="profile-stat-label">Avg +/-</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-value">{stats.totalBirdies}</span>
              <span className="profile-stat-label">Birdies</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-value">{stats.roundsLast30d}</span>
              <span className="profile-stat-label">Last 30 days</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-value">
                {stats.bestScoreToPar != null ? formatScoreToPar(stats.bestScoreToPar) : '—'}
              </span>
              <span className="profile-stat-label">Best round</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-value">
                {stats.avgPutts != null ? stats.avgPutts : '—'}
              </span>
              <span className="profile-stat-label">Avg putts/hole</span>
            </div>
          </div>
        )}
      </div>

      {stats && stats.recentRounds.length > 0 && (
        <div className="card">
          <h3>Recent rounds</h3>
          <ul className="stats-recent-list">
            {stats.recentRounds.map(r => (
              <li key={r.roundId}>
                <Link to={`/rounds/${r.roundId}`}>
                  {r.courseName ?? 'Course'} — {r.totalStrokes}{' '}
                  ({formatScoreToPar(r.scoreToPar)})
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {discs.length > 0 && (
        <div className="card">
          <h3>Disc performance</h3>
          <p className="muted small">Discs you&apos;ve thrown 3+ times in logged rounds.</p>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Disc</th>
                <th>Style</th>
                <th>Throws</th>
                <th>Avg</th>
                <th>+/-</th>
              </tr>
            </thead>
            <tbody>
              {discs.map(d => (
                <tr key={`${d.discName}-${d.throwStyle}`}>
                  <td>{d.discName}</td>
                  <td>{d.throwStyle}</td>
                  <td>{d.throws}</td>
                  <td>{d.avgStrokes ?? '—'}</td>
                  <td>{d.avgToPar != null ? formatScoreToPar(d.avgToPar) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
