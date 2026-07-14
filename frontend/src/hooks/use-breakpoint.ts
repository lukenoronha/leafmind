import * as React from 'react'

/** Generalized version of use-mobile's pattern for an arbitrary min-width
 * breakpoint — used where a component needs to branch behavior (not just
 * styling) between viewport tiers, e.g. choosing which Sheet side/variant
 * to actually mount rather than CSS-hiding an already-mounted one. */
export function useMinWidth(px: number) {
  const [matches, setMatches] = React.useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia(`(min-width: ${px}px)`).matches,
  )

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${px}px)`)
    const onChange = () => setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [px])

  return matches
}
