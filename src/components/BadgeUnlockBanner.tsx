import { PlayerBadge } from '../types'

export function BadgeUnlockBanner({
  badges,
  onDismiss,
}: {
  badges: PlayerBadge[]
  onDismiss: () => void
}) {
  if (badges.length === 0) return null

  return (
    <div className="card badge-unlock-banner">
      <div className="badge-unlock-head">
        <strong>
          {badges.length === 1 ? 'Badge unlocked!' : `${badges.length} badges unlocked!`}
        </strong>
        <button type="button" className="link-button" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
      <ul className="badge-unlock-list">
        {badges.map(b => (
          <li key={b.slug} className="badge-unlock-item">
            <span className="badge-unlock-icon" aria-hidden>
              {b.icon}
            </span>
            <div>
              <strong>{b.title}</strong>
              <p className="muted small">{b.description}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="muted small badge-unlock-share-hint">
        Share your round recap below — great time to post a league night clip or screenshot.
      </p>
    </div>
  )
}
