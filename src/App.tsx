import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { isSupabaseConfigured } from './lib/supabase'
import { refreshDiscsFromSupabase } from './lib/discs'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Navigation } from './components/Navigation'
import { ScrollToTop } from './components/ScrollToTop'
import { SetupScreen } from './components/SetupScreen'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { HomePage } from './pages/HomePage'
import { BagsListPage } from './pages/BagsListPage'
import { CoursesPage } from './pages/CoursesPage'
import { SettingsPage } from './pages/SettingsPage'
import { UpgradePage } from './pages/UpgradePage'
import { WelcomePage } from './pages/WelcomePage'
import { UpdatesPage } from './pages/UpdatesPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'
import { RoundsPage } from './pages/RoundsPage'
import { CommunityPage } from './pages/CommunityPage'
import { CommunityMessagesPage } from './pages/CommunityMessagesPage'
import { ProfilePage } from './pages/ProfilePage'
import { RoundSharePage } from './pages/RoundSharePage'
import { InvitePage } from './pages/InvitePage'
import { StatsPage } from './pages/StatsPage'
import { CoursePlaybookPage } from './pages/CoursePlaybookPage'
import { LeaguesPage } from './pages/LeaguesPage'
import { EventsPage } from './pages/EventsPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { SocialHubPage } from './pages/SocialHubPage'
import { LibraryHubPage } from './pages/LibraryHubPage'

function AppShell() {
  const { session, me, loading } = useAuth()
  const location = useLocation()
  const isSharePage = location.pathname.startsWith('/share/')
  const isInvitePage = location.pathname.startsWith('/invite')
  if (loading) {
    return (
      <div className="auth-loading">
        <div className="spinner" />
      </div>
    )
  }
  return (
    <>
      <ScrollToTop />
      {session && me?.onboardingComplete && !isSharePage && !isInvitePage && (
        <Navigation />
      )}
      <main className="main">
        <Routes>
          <Route
            path="/login"
            element={session ? <Navigate to="/" replace /> : <LoginPage />}
          />
          <Route
            path="/signup"
            element={session ? <Navigate to="/" replace /> : <SignupPage />}
          />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/share/:token" element={<RoundSharePage />} />
          <Route path="/invite" element={<InvitePage />} />

          <Route
            path="/welcome"
            element={
              <ProtectedRoute requireOnboarding={false} requireUpdates={false}>
                <WelcomePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/updates"
            element={
              <ProtectedRoute requireUpdates={false}>
                <UpdatesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bags"
            element={
              <ProtectedRoute>
                <BagsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courses"
            element={
              <ProtectedRoute>
                <CoursesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rounds/:roundId?"
            element={
              <ProtectedRoute>
                <RoundsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/social"
            element={
              <ProtectedRoute>
                <SocialHubPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/library"
            element={
              <ProtectedRoute>
                <LibraryHubPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/community"
            element={
              <ProtectedRoute>
                <CommunityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/community/messages"
            element={
              <ProtectedRoute>
                <CommunityMessagesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/community/messages/:partnerId"
            element={
              <ProtectedRoute>
                <CommunityMessagesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stats"
            element={
              <ProtectedRoute>
                <StatsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/playbook"
            element={
              <ProtectedRoute>
                <CoursePlaybookPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leagues"
            element={
              <ProtectedRoute>
                <LeaguesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/community/events"
            element={
              <ProtectedRoute>
                <EventsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/community/scheduled"
            element={<Navigate to="/community/events" replace />}
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upgrade"
            element={
              <ProtectedRoute>
                <UpgradePage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}

export default function App() {
  // Fire-and-forget: the bundled snapshot is sufficient for instant render;
  // this just keeps the in-memory catalog fresh if the DB has drifted.
  useEffect(() => {
    if (isSupabaseConfigured) {
      refreshDiscsFromSupabase().catch(err =>
        console.warn('[app] disc catalog refresh failed', err),
      )
    }
  }, [])

  if (!isSupabaseConfigured) {
    return <SetupScreen />
  }
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  )
}
