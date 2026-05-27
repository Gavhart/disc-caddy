/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Public web URL — required in native builds for auth email links (https://thedisccaddy.com) */
  readonly VITE_APP_URL?: string
  /** Monthly Pro price — prefer VITE_STRIPE_PRICE_ID_MONTHLY over legacy VITE_STRIPE_PRICE_ID */
  readonly VITE_STRIPE_PRICE_ID?: string
  readonly VITE_STRIPE_PRICE_ID_MONTHLY?: string
  readonly VITE_STRIPE_PRICE_ID_ANNUAL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
