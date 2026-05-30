import { Link } from 'react-router-dom'
import type { CaddyAdherenceStats } from '../types'
import { throwPhaseLabel } from '../lib/throwPhase'

export function CaddyAdherencePanel({
  stats,
  title = 'Caddy vs your bag',
  compact = false,
  showStatsLink = false,
}: {
  stats: CaddyAdherenceStats
  title?: string
  compact?: boolean
  showStatsLink?: boolean
}) {
  if (stats.totalThrows === 0) {
    return (
      <div className={`caddy-adherence-panel${compact ? ' caddy-adherence-compact' : ''}`}>
        <h3>{title}</h3>
        <p className="muted small">
          Log throws in <strong>Hole progress</strong> during a live round to see how often you
          follow the top pick vs your own choices.
        </p>
      </div>
    )
  }

  const pct = stats.adherencePct ?? 0

  return (
    <div className={`caddy-adherence-panel${compact ? ' caddy-adherence-compact' : ''}`}>
      <div className="caddy-adherence-head">
        <h3>{title}</h3>
        {showStatsLink && (
          <Link to="/library/stats" className="link-button small">
            Full stats →
          </Link>
        )}
      </div>
      <p className="muted small">
        {stats.topPickThrows} of {stats.totalThrows} logged throws used the Caddy&apos;s top pick
        ({pct}%).
      </p>

      <div
        className="caddy-adherence-bar"
        role="img"
        aria-label={`${pct}% top pick adherence`}
      >
        <span
          className="caddy-adherence-bar-top"
          style={{ width: `${pct}%` }}
        />
      </div>

      {stats.byPhase.length > 0 && (
        <ul className="caddy-adherence-phases">
          {stats.byPhase.map(row => (
            <li key={row.throwPhase}>
              <span>{throwPhaseLabel(row.throwPhase)}</span>
              <span className="muted small">
                {row.topPickThrows}/{row.total} top pick
              </span>
            </li>
          ))}
        </ul>
      )}

      {stats.offScriptDiscs.length > 0 && (
        <div className="caddy-adherence-off-script">
          <span className="small">
            <strong>Your calls</strong> — discs you threw instead of the top pick:
          </span>
          <ul className="caddy-adherence-disc-list">
            {stats.offScriptDiscs.slice(0, compact ? 4 : 8).map(d => (
              <li key={d.discName}>
                {d.discName}
                <span className="muted small"> · {d.throws}×</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
