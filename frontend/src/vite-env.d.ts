/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_APP_NAME: string
  readonly VITE_APP_ENV: 'development' | 'staging' | 'production'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Build-time constants injected via `define` in vite.config.ts.
declare const __APP_VERSION__: string
declare const __BUILD_DATE__: string
declare const __GIT_COMMIT__: string | null
