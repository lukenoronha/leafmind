export const env = {
  apiBaseUrl:
    import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1',
  appName: import.meta.env.VITE_APP_NAME ?? 'LeafMind',
  appEnv: import.meta.env.VITE_APP_ENV ?? 'development',
} as const
