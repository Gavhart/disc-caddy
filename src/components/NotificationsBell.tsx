import { NavLink } from 'react-router-dom'

interface NotificationsBellProps {
  count: number
  className?: string
}

export function NotificationsBell({ count, className = '' }: NotificationsBellProps) {
  const label =
    count > 0
      ? `${count} unread notification${count === 1 ? '' : 's'}`
      : 'Notifications'

  return (
    <NavLink
      to="/notifications"
      className={'nav-bell' + (className ? ` ${className}` : '')}
      aria-label={label}
      title={label}
    >
      <svg
        className="nav-bell-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {count > 0 && (
        <span className="nav-bell-badge" aria-hidden>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </NavLink>
  )
}
