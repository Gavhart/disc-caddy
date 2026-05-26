import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { signOut } from '../lib/auth'
import { ProfileNameEditor } from '../components/ProfileNameEditor'
import { ProfilePhotoUploader } from '../components/ProfilePhotoUploader'
import { FriendsSection } from '../components/FriendsSection'
import { FriendActivityFeed } from '../components/FriendActivityFeed'
import { WeeklyChallengesPanel } from '../components/WeeklyChallengesPanel'
import { fetchMyHomeCities, formatCityLabel } from '../lib/community'
import { isWebCheckoutAvailable } from '../lib/platform'
import { HomeCity } from '../types'

function handLabel(hand: 'left' | 'right'): string {
  return hand === 'left' ? 'Left-handed' : 'Right-handed'
}

function throwLabel(primary: 'backhand' | 'forehand', throwsFh: boolean): string {
  if (primary === 'forehand') return 'Forehand primary'
  return throwsFh ? 'Backhand + forehand' : 'Backhand'
}

export function ProfilePage() {
  const { me, refreshMe } = useAuth()
  const navigate = useNavigate()
  const [cities, setCities] = useState<HomeCity[]>([])
  const [citiesLoading, setCitiesLoading] = useState(true)

  useEffect(() => {
    if (!me) return
    setCitiesLoading(true)
    fetchMyHomeCities()
      .then(setCities)
      .catch(() => setCities([]))
      .finally(() => setCitiesLoading(false))
  }, [me])

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  if (!me) {
    return (
      <div className="container profile-page">
        <div className="card">
          <p className="muted">Loading…</p>
        </div>
      </div>
    )
  }

  const savedCities = cities.filter(c => c.city.trim())

  return (
    <div className="container profile-page">
      <div className="profile-hero card">
        <ProfilePhotoUploader
          avatarPath={me.avatarPath}
          displayName={me.displayName}
          onChange={async () => {
            await refreshMe()
          }}
        />
        <div className="profile-hero-text">
          <ProfileNameEditor variant="hero" />
          <p className="profile-email muted">{me.email}</p>
          <div className="profile-badges">
            {me.isPro ? (
              <span className="pill pill-pro">Pro</span>
            ) : (
              <span className="pill">Free</span>
            )}
            {me.communityVisible && (
              <span className="pill profile-pill-community">On Community</span>
            )}
            {me.lookingForPlayers && (
              <span className="pill profile-pill-looking">Looking to play</span>
            )}
          </div>
        </div>
      </div>

      <div className="card profile-stats">
        <div className="profile-stat">
          <span className="profile-stat-value">{me.maxDistance} ft</span>
          <span className="profile-stat-label">Driver max</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-value">{handLabel(me.dominantHand)}</span>
          <span className="profile-stat-label">Hand</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-value">
            {throwLabel(me.primaryThrow, me.throwsForehand)}
          </span>
          <span className="profile-stat-label">Throw style</span>
        </div>
      </div>

      {!citiesLoading && savedCities.length > 0 && (
        <div className="card">
          <h2>Home areas</h2>
          <ul className="profile-city-list">
            {savedCities.map(c => (
              <li key={cityKey(c)}>{formatCityLabel(c)}</li>
            ))}
          </ul>
          <Link to="/community" className="link-button profile-inline-link">
            Edit on Community →
          </Link>
        </div>
      )}

      <FriendsSection />

      <FriendActivityFeed />

      <WeeklyChallengesPanel />

      <div className="profile-menu">
        <h2 className="profile-menu-heading">Play &amp; improve</h2>
        <Link to="/stats" className="profile-menu-item card">
          <span className="profile-menu-icon" aria-hidden>
            📈
          </span>
          <span className="profile-menu-copy">
            <strong>Player stats</strong>
            <span className="muted small">Trends, birdies, and disc performance (Pro)</span>
          </span>
          <span className="profile-menu-chevron" aria-hidden>
            ›
          </span>
        </Link>
        <Link to="/playbook" className="profile-menu-item card">
          <span className="profile-menu-icon" aria-hidden>
            📖
          </span>
          <span className="profile-menu-copy">
            <strong>Course playbook</strong>
            <span className="muted small">Hole strategy and your scoring history</span>
          </span>
          <span className="profile-menu-chevron" aria-hidden>
            ›
          </span>
        </Link>
        <Link to="/leagues" className="profile-menu-item card">
          <span className="profile-menu-icon" aria-hidden>
            🏆
          </span>
          <span className="profile-menu-copy">
            <strong>Leagues</strong>
            <span className="muted small">Season standings with your group</span>
          </span>
          <span className="profile-menu-chevron" aria-hidden>
            ›
          </span>
        </Link>
      </div>

      <div className="profile-menu">
        <h2 className="profile-menu-heading">Settings &amp; account</h2>
        <Link to="/settings#player" className="profile-menu-item card">
          <span className="profile-menu-icon" aria-hidden>
            🥏
          </span>
          <span className="profile-menu-copy">
            <strong>Player settings</strong>
            <span className="muted small">
              Hand, throw style, and distance by disc type
            </span>
          </span>
          <span className="profile-menu-chevron" aria-hidden>
            ›
          </span>
        </Link>
        <Link to="/community/messages" className="profile-menu-item card">
          <span className="profile-menu-icon" aria-hidden>
            💬
          </span>
          <span className="profile-menu-copy">
            <strong>Messages</strong>
            <span className="muted small">
              {me.isPro
                ? 'Community inbox and replies'
                : 'Read inbox · Pro required to send'}
            </span>
          </span>
          <span className="profile-menu-chevron" aria-hidden>
            ›
          </span>
        </Link>
        <Link to="/community" className="profile-menu-item card">
          <span className="profile-menu-icon" aria-hidden>
            👥
          </span>
          <span className="profile-menu-copy">
            <strong>Community</strong>
            <span className="muted small">
              Home cities, visibility, and local messages
            </span>
          </span>
          <span className="profile-menu-chevron" aria-hidden>
            ›
          </span>
        </Link>
        <Link to="/settings#subscription" className="profile-menu-item card">
          <span className="profile-menu-icon" aria-hidden>
            ✨
          </span>
          <span className="profile-menu-copy">
            <strong>Subscription</strong>
            <span className="muted small">
              {me.isPro ? 'Manage your Pro plan' : 'Upgrade or sync billing'}
            </span>
          </span>
          <span className="profile-menu-chevron" aria-hidden>
            ›
          </span>
        </Link>
        <Link to="/settings#account" className="profile-menu-item card">
          <span className="profile-menu-icon" aria-hidden>
            ⚙️
          </span>
          <span className="profile-menu-copy">
            <strong>Account &amp; legal</strong>
            <span className="muted small">
              Email, session, privacy, and delete account
            </span>
          </span>
          <span className="profile-menu-chevron" aria-hidden>
            ›
          </span>
        </Link>
        <Link to="/updates" className="profile-menu-item card">
          <span className="profile-menu-icon" aria-hidden>
            📣
          </span>
          <span className="profile-menu-copy">
            <strong>What&apos;s new</strong>
            <span className="muted small">Release notes and roadmap</span>
          </span>
          <span className="profile-menu-chevron" aria-hidden>
            ›
          </span>
        </Link>
      </div>

      {!me.isPro && isWebCheckoutAvailable() && (
        <Link to="/upgrade" className="btn-primary profile-upgrade-btn">
          Upgrade to Pro
        </Link>
      )}

      <button type="button" className="btn-secondary profile-signout-btn" onClick={handleSignOut}>
        Sign out
      </button>
    </div>
  )
}

function cityKey(c: HomeCity): string {
  return `${c.city}|${c.regionCode ?? ''}|${c.countryCode ?? ''}|${c.sortOrder}`
}
