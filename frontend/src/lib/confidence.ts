export type ConfidenceTier = 'high' | 'medium' | 'low' | 'very-low'

/** Species-identification confidence tiers — distinct from the generic
 * RAG match-score shown on source cards. Boundaries match the Visual
 * Design System §07 four-tier system. */
export function getConfidenceTier(value: number): ConfidenceTier {
  if (value >= 0.85) return 'high'
  if (value >= 0.6) return 'medium'
  if (value >= 0.35) return 'low'
  return 'very-low'
}
