/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string // public, D38
  readonly VITE_SUPABASE_ANON_KEY: string // public, D38
  readonly VITE_APP_BASE_URL: string // share links, D13
  readonly VITE_BASE_PATH: string // '/' on the custom domain, '/phibsboro/' on the Pages project page
  readonly VITE_SENTRY_DSN: string // S0.6
  readonly VITE_SENTRY_RELEASE: string // the commit SHA, D16
  readonly VITE_SENTRY_ENVIRONMENT: string // 'production' | 'preview' | 'local'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
