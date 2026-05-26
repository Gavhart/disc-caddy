import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { signOut } from '../lib/auth'
import { isWebCheckoutAvailable } from '../lib/platform'
import { ProfileAvatar } from './ProfileAvatar'
import { Logo } from './Logo'

const NAV_ITEMS = [
  { to: '/', end: true, label: 'Recommend', icon: '🎯' },
  { to: '/bags', label: 'Bags', icon: '🎒' },
  { to: '/courses', label: 'Courses', icon: '🗺️' },
  { to: '/rounds', label: 'Rounds', icon: '📋' },
  { to: '/community', label: 'Community', icon: '👥' },
  { to: '/profile', label: 'Profile', icon: '👤' },
] as const

function isProfileRoute(pathname: string): boolean {
  return pathname === '/profile' || pathname.startsWith('/settings')
}

function isCommunityRoute(pathname: string): boolean {
  return pathname === '/community' || pathname.startsWith('/community/')
}

export function Navigation() {
  const { me } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname, location.hash])

  useEffect(() => {
    document.body.classList.toggle('nav-menu-open', menuOpen)
    return () => document.body.classList.remove('nav-menu-open')
  }, [menuOpen])

  async function handleSignOut() {
    setMenuOpen(false)
    await signOut()
    navigate('/login', { replace: true })
  }

  function closeMenu() {
    setMenuOpen(false)
  }

  const drawer = (
    <div
      id="nav-drawer"
      className={`nav-drawer${menuOpen ? ' nav-drawer-open' : ''}`}
      aria-hidden={!menuOpen}
    >
      <button
        type="button"
        className="nav-drawer-backdrop"
        aria-label="Close menu"
        onClick={closeMenu}
        tabIndex={menuOpen ? 0 : -1}
      />
      <div className="nav-drawer-panel" role="dialog" aria-modal="true" aria-label="App menu">
        <div className="nav-drawer-header">
          <p className="nav-drawer-title">Menu</p>
          <button type="button" className="link-button nav-drawer-close" onClick={closeMenu}>
            Close
          </button>
        </div>

        <NavLink to="/profile" className="nav-drawer-profile" onClick={closeMenu}>
          <ProfileAvatar
            displayName={me?.displayName}
            avatarPath={me?.avatarPath}
            size="sm"
            className="nav-drawer-avatar"
          />
          <span className="nav-drawer-profile-copy">
            <strong>{me?.displayName?.trim() || 'Add your name'}</strong>
            <span className="muted small">{me?.email}</span>
          </span>
          <span className="nav-drawer-chevron" aria-hidden>
            ›
          </span>
        </NavLink>

        <div className="nav-drawer-links">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : undefined}
              className={({ isActive }) => {
                const active =
                  item.to === '/profile'
                    ? isActive || isProfileRoute(location.pathname)
                    : item.to === '/community'
                      ? isActive || isCommunityRoute(location.pathname)
                      : isActive
                return 'nav-drawer-link' + (active ? ' active' : '')
              }}
              onClick={closeMenu}
            >
              <span className="nav-drawer-link-icon" aria-hidden>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
          {me && !me.isPro && isWebCheckoutAvailable() && (
            <NavLink
              to="/upgrade"
              className="nav-drawer-link nav-drawer-upgrade"
              onClick={closeMenu}
            >
              <span className="nav-drawer-link-icon" aria-hidden>
                ✨
              </span>
              <span>Upgrade to Pro</span>
            </NavLink>
          )}
        </div>

        <div className="nav-drawer-footer">
          <button type="button" className="link-button nav-drawer-signout" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <nav className="nav">
      <button
        type="button"
        className={`nav-menu-btn${menuOpen ? ' nav-menu-btn-open' : ''}`}
        aria-expanded={menuOpen}
        aria-controls="nav-drawer"
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        onClick={() => setMenuOpen(open => !open)}
      >
        <span className="nav-menu-disc" aria-hidden />
        <span className="nav-menu-lines" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </button>

      <NavLink to="/" end className="nav-brand">
        <Logo height={40} />
      </NavLink>

      <NavLink
        to="/profile"
        className={({ isActive }) =>
          'nav-profile-chip' + (isActive || isProfileRoute(location.pathname) ? ' active' : '')
        }
        aria-label="Your profile"
        onClick={() => setMenuOpen(false)}
      >
        <ProfileAvatar
          displayName={me?.displayName}
          avatarPath={me?.avatarPath}
          size="sm"
          className="nav-profile-avatar"
        />
      </NavLink>

      <div className="nav-links nav-links-desktop">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={'end' in item ? item.end : undefined}
            className={({ isActive }) => {
              const active =
                item.to === '/profile'
                  ? isActive || isProfileRoute(location.pathname)
                  : item.to === '/community'
                    ? isActive || isCommunityRoute(location.pathname)
                    : isActive
              return active ? 'active' : ''
            }}
          >
            {item.label}
          </NavLink>
        ))}
        {me && !me.isPro && isWebCheckoutAvailable() && (
          <NavLink to="/upgrade" className="nav-upgrade">
            Upgrade ✨
          </NavLink>
        )}
      </div>

      {createPortal(drawer, document.body)}
    </nav>
  )
}
