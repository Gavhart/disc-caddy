import { Link } from 'react-router-dom'

interface HubCardProps {
  to: string
  icon: string
  title: string
  description: string
  badge?: number
}

export function HubCard({ to, icon, title, description, badge }: HubCardProps) {
  return (
    <Link to={to} className="hub-card card">
      <span className="hub-card-icon" aria-hidden>
        {icon}
      </span>
      <span className="hub-card-body">
        <span className="hub-card-title-row">
          <strong>{title}</strong>
          {badge != null && badge > 0 && (
            <span className="hub-card-badge">{badge > 99 ? '99+' : badge}</span>
          )}
        </span>
        <span className="hub-card-desc muted small">{description}</span>
      </span>
      <span className="hub-card-chevron" aria-hidden>
        ›
      </span>
    </Link>
  )
}
