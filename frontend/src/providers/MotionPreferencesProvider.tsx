import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { MotionConfig } from 'framer-motion'
import {
  MotionPreferencesContext,
  type MotionPreferencesContextValue,
} from '@/providers/motion-preferences-context'

const STORAGE_KEY = 'leafmind_reduce_motion'
const MEDIA_QUERY = '(prefers-reduced-motion: reduce)'

function readInitialOverride(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

function readSystemPreference(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(MEDIA_QUERY).matches
}

/**
 * App-level animation preference behind the Settings page's "Animations" /
 * "Reduced Motion" toggles (two views of the same stored value). The
 * override is applied through Framer Motion's own mechanism:
 * `MotionConfig reducedMotion="always"` disables transform and layout
 * animations in every motion component app-wide, while "user" defers to
 * the OS prefers-reduced-motion setting — which the app's existing
 * `useReducedMotion()` call sites already handle.
 */
export function MotionPreferencesProvider({
  children,
}: {
  children: ReactNode
}) {
  const [reduceMotionOverride, setOverride] = useState(readInitialOverride)
  const [systemReducedMotion, setSystemReducedMotion] =
    useState(readSystemPreference)

  useEffect(() => {
    const mediaQueryList = window.matchMedia(MEDIA_QUERY)
    const onChange = (event: MediaQueryListEvent) =>
      setSystemReducedMotion(event.matches)
    mediaQueryList.addEventListener('change', onChange)
    return () => mediaQueryList.removeEventListener('change', onChange)
  }, [])

  const setReduceMotionOverride = useCallback((enabled: boolean) => {
    setOverride(enabled)
    localStorage.setItem(STORAGE_KEY, String(enabled))
  }, [])

  const value = useMemo<MotionPreferencesContextValue>(
    () => ({
      systemReducedMotion,
      reduceMotionOverride,
      isMotionReduced: systemReducedMotion || reduceMotionOverride,
      setReduceMotionOverride,
    }),
    [systemReducedMotion, reduceMotionOverride, setReduceMotionOverride],
  )

  return (
    <MotionPreferencesContext.Provider value={value}>
      <MotionConfig reducedMotion={reduceMotionOverride ? 'always' : 'user'}>
        {children}
      </MotionConfig>
    </MotionPreferencesContext.Provider>
  )
}
