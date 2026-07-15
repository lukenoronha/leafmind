import { useContext } from 'react'
import { MotionPreferencesContext } from '@/providers/motion-preferences-context'

export function useMotionPreferences() {
  const context = useContext(MotionPreferencesContext)
  if (!context) {
    throw new Error(
      'useMotionPreferences must be used within a MotionPreferencesProvider',
    )
  }
  return context
}
