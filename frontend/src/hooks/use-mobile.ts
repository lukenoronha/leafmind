import * as React from 'react'

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Lazily initialized from a real synchronous read (matching useMinWidth's
  // pattern) rather than starting at `undefined` and coercing to `false`
  // via `!!` — that coercion made every consumer briefly evaluate as
  // "desktop" on an actual mobile device's very first render, until the
  // effect below corrected it on the next tick.
  const [isMobile, setIsMobile] = React.useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT,
  )

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
