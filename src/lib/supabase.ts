import { createClient, SupabaseClient } from '@supabase/supabase-js'

function normalizeEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function isValidSupabaseUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const url = normalizeEnv(import.meta.env.VITE_SUPABASE_URL)
const anonKey = normalizeEnv(import.meta.env.VITE_SUPABASE_ANON_KEY)

/** True when env vars are present and the URL is valid. Shows setup screen otherwise. */
export const isSupabaseConfigured = Boolean(
  url && anonKey && isValidSupabaseUrl(url),
)

if (!isSupabaseConfigured) {
  console.warn(
    '[disc-caddy] Missing or invalid VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env.local (or set them in Vercel → Environment Variables) ' +
      'and redeploy.',
  )
}

// Never pass an empty/invalid URL to createClient — it throws and blanks the whole app.
const clientUrl = isSupabaseConfigured ? url! : 'http://127.0.0.1'
const clientKey = isSupabaseConfigured ? anonKey! : 'anon'

export const supabase: SupabaseClient = createClient(clientUrl, clientKey)
