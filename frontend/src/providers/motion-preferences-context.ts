import { createContext } from 'react'

export interface MotionPreferencesContextValue {
  /** True when the OS itself requests reduced motion (prefers-reduced-motion). */
  systemReducedMotion: boolean
  /** True when the user forced reduced motion from Settings. */
  reduceMotionOverride: boolean
  /** Effective value the app animates against: system OR override. */
  isMotionReduced: boolean
  setReduceMotionOverride: (enabled: boolean) => void
}

export const MotionPreferencesContext = createContext<
  MotionPreferencesContextValue | undefined
>(undefined)
