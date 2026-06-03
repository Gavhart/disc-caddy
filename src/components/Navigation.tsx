import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  isLibraryRoute,
  isPlayRoute,
  isSocialRoute,
  isYouRoute,
} from '../lib/navRoutes'
import { useAppNotifications } from '../hooks/useAppNotifications'
import { NotificationsBell } from './NotificationsBell'
import { ProfileAvatar } from './ProfileAvatar'
import { Logo } from './Logo'

const PRIMARY_TABS = [
  { to: '/', end: true, label: 'Play', icon: '🎯', match: isPlayRoute },
  { to: '/social', label: 'Social', icon: '👥', match: isSocialRoute },
  { to: '/library', label: 'Library', icon: '📚', match: isLibraryRoute },
  { to: '/profile', label: 'You', icon: null, match: isYouRoute },
] as const

export function Navigation() {
  const { me, session } = useAuth()
  const location = useLocation()
  const { communityBadgeCount } = useAppNotifications(Boolean(session && me))

  return (
    <>
      <nav className="nav nav-top" aria-label="Main">
        <div className="nav-top-inner">
          <div className="nav-top-slot nav-top-slot-start">
            <NotificationsBell count={communityBadgeCount} />
          </div>

          <NavLink to="/" end className="nav-brand">
            <Logo height={36} />
          </NavLink>

          <div className="nav-top-slot nav-top-slot-end">
            <div className="nav-links-desktop">
              {PRIMARY_TABS.map(tab => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={'end' in tab ? tab.end : undefined}
                  className={({ isActive }) => {
                    const active = tab.match(location.pathname) || isActive
                    return active ? 'active' : ''
                  }}
                >
                  {tab.label}
                </NavLink>
              ))}
              <NotificationsBell count={communityBadgeCount} className="nav-bell-desktop" />
            </div>
          </div>
        </div>
      </nav>

      <nav className="nav-tabbar" aria-label="Primary">
        {PRIMARY_TABS.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={'end' in tab ? tab.end : undefined}
            className={({ isActive }) => {
              const active = tab.match(location.pathname) || isActive
              return 'nav-tab' + (active ? ' nav-tab-active' : '')
            }}
          >
            {tab.to === '/profile' ? (
              <ProfileAvatar
                displayName={me?.displayName}
                avatarPath={me?.avatarPath}
                size="sm"
                className="nav-tab-avatar"
              />
            ) : (
              <span className="nav-tab-icon" aria-hidden>
                {tab.icon}
              </span>
            )}
            <span className="nav-tab-label">{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
