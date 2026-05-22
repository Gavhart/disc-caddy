import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { signOut } from '../lib/auth'
import { Logo } from './Logo'

export function Navigation() {
  const { me } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <nav className="nav">
      <NavLink to="/" end className="nav-brand">
        <Logo height={40} />
      </NavLink>
      <div className="nav-links">
        <NavLink to="/" end>
          Recommend
        </NavLink>
        <NavLink to="/bags">Bags</NavLink>
        <NavLink to="/courses">Courses</NavLink>
        <NavLink to="/settings">Settings</NavLink>
        {me && !me.isPro && (
          <NavLink to="/upgrade" className="nav-upgrade">
            Upgrade ✨
          </NavLink>
        )}
        <button onClick={handleSignOut} className="link-button nav-signout">
          Sign out
        </button>
      </div>
    </nav>
  )
}
