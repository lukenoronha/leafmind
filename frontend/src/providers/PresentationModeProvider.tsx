import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  PresentationModeContext,
  type PresentationModeContextValue,
} from '@/providers/presentation-mode-context'

const STORAGE_KEY = 'leafmind_presentation_mode'

function readInitialValue(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

/**
 * Client-side-only display preference for demos: hides admin/developer
 * navigation and other non-essential chrome so the primary workflow is
 * front and center. This is purely cosmetic — it does not affect
 * RoleGuard or route access, so a direct link still respects real
 * permissions even while presentation mode is on.
 */
export function PresentationModeProvider({
  children,
}: {
  children: ReactNode
}) {
  const [isPresentationMode, setIsPresentationMode] = useState(readInitialValue)

  const setPresentationMode = useCallback((enabled: boolean) => {
    setIsPresentationMode(enabled)
    localStorage.setItem(STORAGE_KEY, String(enabled))
  }, [])

  const togglePresentationMode = useCallback(() => {
    setIsPresentationMode((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }, [])

  const value = useMemo<PresentationModeContextValue>(
    () => ({ isPresentationMode, setPresentationMode, togglePresentationMode }),
    [isPresentationMode, setPresentationMode, togglePresentationMode],
  )

  return (
    <PresentationModeContext.Provider value={value}>
      {children}
    </PresentationModeContext.Provider>
  )
}
