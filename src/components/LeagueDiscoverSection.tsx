import { useEffect, useState } from 'react'
import { playModeLabel, skillLevelLabel } from '../data/leagueFeatures'
import { discoverPublicLeagues, joinLeague } from '../lib/leagues'
import { DiscoverableLeague } from '../types'

function formatSeasonRange(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  return `${fmt(start)} – ${fmt(end)}`
}

function formatLabel(format: string): string {
  return format === 'stableford' ? 'Stableford' : 'Stroke'
}

export function LeagueDiscoverSection({
  onJoined,
  onError,
  busy,
  onBusy,
}: {
  onJoined: (leagueId: string) => void
  onError: (msg: string | null) => void
  busy: boolean
  onBusy: (v: boolean) => void
}) {
  const [leagues, setLeagues] = useState<DiscoverableLeague[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    discoverPublicLeagues(24)
      .then(setLeagues)
      .catch(() => setLeagues([]))
      .finally(() => setLoading(false))
  }, [])

  async function handleJoin(inviteCode: string) {
    onBusy(true)
    onError(null)
    try {
      const id = await joinLeague(inviteCode)
      onJoined(id)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not join league')
    } finally {
      onBusy(false)
    }
  }

  return (
    <section className="card">
      <h2 className="section-title">Discover leagues</h2>
      <p className="muted small">
        Public leagues open to new members. Admins can mark a league public when creating or editing.
      </p>

      {loading ? (
        <p className="muted">Loading public leagues…</p>
      ) : leagues.length === 0 ? (
        <p className="muted">No public leagues yet — create one and toggle &quot;Public league&quot;.</p>
      ) : (
        <ul className="league-discover-list">
          {leagues.map(l => (
            <li key={l.id} className="league-discover-item">
              <div>
                <h3>{l.name}</h3>
                {l.description && <p className="muted small">{l.description}</p>}
                <p className="muted small league-discover-meta">
                  {formatSeasonRange(l.seasonStart, l.seasonEnd)} · {formatLabel(l.format)} ·{' '}
                  {playModeLabel(l.playMode)} · {l.memberCount} members
                  {l.location ? ` · ${l.location}` : ''}
                </p>
                <div className="league-card-badges">
                  {l.skillLevel !== 'all' && (
                    <span className="league-format-badge">{skillLevelLabel(l.skillLevel)}</span>
                  )}
                  {l.handicapEnabled && <span className="league-admin-badge">Handicap</span>}
                </div>
              </div>
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => handleJoin(l.inviteCode)}
              >
                Join
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
