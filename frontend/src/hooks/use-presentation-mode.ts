import { useContext } from 'react'
import { PresentationModeContext } from '@/providers/presentation-mode-context'

export function usePresentationMode() {
  const context = useContext(PresentationModeContext)
  if (!context) {
    throw new Error(
      'usePresentationMode must be used within a PresentationModeProvider',
    )
  }
  return context
}
