/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_W3W_API_KEY?: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
  // Stripe Price IDs for subscription tiers
  readonly VITE_STRIPE_PRICE_TEAM_MONTHLY?: string
  readonly VITE_STRIPE_PRICE_TEAM_ANNUAL?: string
  readonly VITE_STRIPE_PRICE_AGENCY_MONTHLY?: string
  readonly VITE_STRIPE_PRICE_AGENCY_ANNUAL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
