import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { isSupabaseConfigured } from './lib/supabase'
import { refreshDiscsFromSupabase } from './lib/discs'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Navigation } from './components/Navigation'
import { SetupScreen } from './components/SetupScreen'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { HomePage } from './pages/HomePage'
import { BagsListPage } from './pages/BagsListPage'
import { CoursesPage } from './pages/CoursesPage'
import { SettingsPage } from './pages/SettingsPage'
import { UpgradePage } from './pages/UpgradePage'

function AppShell() {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="auth-loading">
        <div className="spinner" />
      </div>
    )
  }
  return (
    <>
      {session && <Navigation />}
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
