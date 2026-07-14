import { createContext } from 'react'

export interface PresentationModeContextValue {
  isPresentationMode: boolean
  setPresentationMode: (enabled: boolean) => void
  togglePresentationMode: () => void
}

export const PresentationModeContext = createContext<
  PresentationModeContextValue | undefined
>(undefined)
