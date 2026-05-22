import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { hasUnreadUpdates } from '../lib/updates'

interface Props {
  children: ReactNode
  /** When false, allow access even if onboarding isn't finished (welcome page). */
  requireOnboarding?: boolean
  /** When false, skip the unread-updates redirect (updates page itself). */
  requireUpdates?: boolean
}

export function ProtectedRoute({
  children,
  requireOnboarding = true,
  requireUpdates = true,
}: Props) {
  const { session, me, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="spinner" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requireOnboarding && me === null) {
    return (
      <div className="auth-loading">
        <div className="spinner" />
      </div>
    )
  }

  if (requireOnboarding && me && !me.onboardingComplete) {
    return <Navigate to="/welcome" replace />
  }

  if (
    requireUpdates &&
    requireOnboarding &&
    me?.onboardingComplete &&
    hasUnreadUpdates() &&
    location.pathname !== '/updates'
  ) {
    return <Navigate to="/updates" replace />
  }

  return <>{children}</>
}
