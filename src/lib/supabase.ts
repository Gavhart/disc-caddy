import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Don't throw — let the app boot and show a friendly setup screen instead.
  console.warn(
    '[disc-caddy] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env.local and fill in your Supabase credentials.',
  )
}

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'anon')

/** True when env vars are present. The app shows a setup screen otherwise. */
export const isSupabaseConfigured = Boolean(url && anonKey)
