import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { fetchCaddyAdherenceStats, fetchDiscPerformanceStats, fetchPlayerStatsDashboard, fetchThrowPhaseStats } from '../lib/stats'
import { CaddyAdherencePanel } from '../components/CaddyAdherencePanel'
import { formatScoreToPar } from '../lib/rounds'
import { throwPhaseLabel } from '../lib/throwPhase'
import { CaddyAdherenceStats, DiscPerformanceStat, PlayerStatsDashboard, ThrowPhaseStats } from '../types'

export function StatsPage() {
  const { me } = useAuth()
  const [stats, setStats] = useState<PlayerStatsDashboard | null>(null)
  const [discs, setDiscs] = useState<DiscPerformanceStat[]>([])
  const [phaseStats, setPhaseStats] = useState<ThrowPhaseStats | null>(null)
  const [adherence, setAdherence] = useState<CaddyAdherenceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!me) {
      setLoading(false)
      return
    }
    Promise.all([
      fetchPlayerStatsDashboard(),
      fetchDiscPerformanceStats(),
      fetchThrowPhaseStats(),
      fetchCaddyAdherenceStats(),
    ])
      .then(([s, d, p, a]) => {
        setStats(s)
        setDiscs(d)
        setPhaseStats(p)
        setAdherence(a)
      })
      .catch(err =>
        setError(err instanceof Error ? err.message : 'Could not load stats'),
      )
      .finally(() => setLoading(false))
  }, [me])

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

      {adherence && (
        <div className="card">
          <CaddyAdherencePanel stats={adherence} />
        </div>
      )}

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

      {phaseStats && phaseStats.totals.length > 0 && (
        <div className="card">
          <h3>Throw phases</h3>
          <p className="muted small">
            From logged throws in Hole progress — drives, approaches, and putts auto-classified
            by distance left to the basket.
          </p>
          <div className="stats-phase-grid">
            {phaseStats.totals.map(row => (
              <div key={row.throwPhase} className={`stats-phase-card stats-phase-${row.throwPhase}`}>
                <span className="stats-phase-label">{throwPhaseLabel(row.throwPhase)}</span>
                <strong>{row.throws}</strong>
                <span className="muted small">throws</span>
                {row.avgDistanceFt != null && (
                  <span className="muted small">avg {row.avgDistanceFt} ft</span>
                )}
              </div>
            ))}
          </div>
          {phaseStats.byDisc.length > 0 && (
            <table className="leaderboard-table" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>Disc</th>
                  <th>Phase</th>
                  <th>Throws</th>
                  <th>Avg dist</th>
                </tr>
              </thead>
              <tbody>
                {phaseStats.byDisc.map(row => (
                  <tr key={`${row.discName}-${row.throwPhase}`}>
                    <td>{row.discName}</td>
                    <td>{throwPhaseLabel(row.throwPhase)}</td>
                    <td>{row.throws}</td>
                    <td>{row.avgDistanceFt != null ? `${row.avgDistanceFt} ft` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
