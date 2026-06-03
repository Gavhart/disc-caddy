import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { fetchMe } from '../lib/profile'
import { Me } from '../types'

/**
 * Disc Caddy is currently free for everyone — there is no paid tier. We
 * force isPro = true at the AuthContext boundary so every gated feature
 * (multi-bag, live rounds, messaging, stats, hole memory) is available
 * without a subscription. Reintroduce real subscription handling here when
 * we add Apple IAP + Stripe parity in a future release.
 */
function clampForPlatform(profile: Me | null): Me | null {
  if (!profile) return profile
  return {
    ...profile,
    isPro: true,
    subscriptionTier: 'pro',
  }
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  me: Me | null
  loading: boolean
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshMe = useCallback(async () => {
    try {
      const m = await fetchMe()
      setMe(clampForPlatform(m))
    } catch (err) {
      console.error('[auth] failed to fetch profile', err)
      setMe(null)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return
        setSession(newSession)
      },
    )

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  // When the session changes, refresh the profile.
  useEffect(() => {
    if (session?.user) {
      refreshMe()
    } else {
      setMe(null)
    }
  }, [session, refreshMe])

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, me, loading, refreshMe }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
