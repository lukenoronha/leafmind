export const ROUTES = {
  home: '/',
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  sessionExpired: '/session-expired',
  unauthorized: '/unauthorized',
  dashboard: '/dashboard',
  history: '/history',
  savedReports: '/saved-reports',
  chatHistory: '/chat-history',
  user: '/user',
  developer: '/developer',
  admin: '/admin',
  settings: '/settings',
  help: '/help',
  notFound: '*',
} as const

/** Reopens a past analysis session (History/Saved Reports → full session
 * view). A function rather than a flat string since it needs the ID. */
export function analysisSessionRoute(predictionId: string) {
  return `/analysis/${predictionId}`
}

export const ANALYSIS_SESSION_PATH = '/analysis/:predictionId'
