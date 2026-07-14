export interface SuggestedTopic {
  id: string
  label: string
  prompt: string
  /** Lowercase keywords used to detect whether this topic has already been
   * asked about, matched against the user's own sent messages. Purely a
   * client-side heuristic over real conversation text — there is no
   * backend intent-classification endpoint to draw this from. */
  keywords: string[]
}

// "Core" surfaces first and is what a first-time user sees; "deep" only
// enters rotation once at least one core topic has been asked, per the
// Visual Design System's breadth-before-depth sequencing (§12).
export const CORE_TOPICS: SuggestedTopic[] = [
  {
    id: 'medicinal-uses',
    label: 'Medicinal uses',
    prompt: 'What are the traditional medicinal uses of this plant?',
    keywords: ['medicinal', 'medicine', 'treat', 'used for', 'benefit'],
  },
  {
    id: 'dosage',
    label: 'Dosage',
    prompt: 'How is this plant typically prepared or dosed?',
    keywords: ['dose', 'dosage', 'how much', 'prepared', 'preparation'],
  },
  {
    id: 'side-effects',
    label: 'Side effects',
    prompt: 'Are there any side effects or risks to be aware of?',
    keywords: ['side effect', 'risk', 'danger', 'safe', 'safety'],
  },
  {
    id: 'toxicity',
    label: 'Toxicity',
    prompt: 'Is this plant toxic in any form or dosage?',
    keywords: ['toxic', 'toxicity', 'poison', 'harmful'],
  },
]

export const DEEP_TOPICS: SuggestedTopic[] = [
  {
    id: 'compounds',
    label: 'Chemical compounds',
    prompt: 'What active compounds does it contain?',
    keywords: ['compound', 'chemical', 'active ingredient', 'constituent'],
  },
  {
    id: 'taxonomy',
    label: 'Taxonomy',
    prompt: 'What is the botanical classification of this plant?',
    keywords: ['taxonomy', 'classification', 'family', 'genus', 'species'],
  },
  {
    id: 'ayurvedic-uses',
    label: 'Ayurvedic uses',
    prompt: 'How is this plant used in Ayurvedic medicine?',
    keywords: ['ayurved', 'traditional medicine', 'folk medicine'],
  },
  {
    id: 'environmental-importance',
    label: 'Environmental importance',
    prompt: 'What role does this plant play in its ecosystem?',
    keywords: ['ecosystem', 'environment', 'habitat', 'grows'],
  },
]

export const COMPARE_TOPIC: SuggestedTopic = {
  id: 'compare',
  label: 'Compare with similar plants',
  prompt: 'How does this compare to other plants it could be mistaken for?',
  keywords: ['compare', 'similar', 'difference between', 'versus'],
}

function wasAsked(topic: SuggestedTopic, askedText: string): boolean {
  return topic.keywords.some((keyword) => askedText.includes(keyword))
}

/**
 * Picks up to `limit` suggestion chips: unexplored core topics first, then
 * deep topics once at least one core topic has been covered, reserving one
 * slot for the comparison prompt when runner-up candidates exist. Falls
 * back to re-offering core topics (so the row is never empty) once
 * everything else has been asked.
 */
export function selectSuggestedTopics({
  userMessages,
  hasRunnerUpCandidate,
  limit = 4,
}: {
  userMessages: string[]
  hasRunnerUpCandidate: boolean
  limit?: number
}): SuggestedTopic[] {
  const askedText = userMessages.join(' ').toLowerCase()
  const coreAsked = CORE_TOPICS.filter((topic) => wasAsked(topic, askedText))
  const coreUnasked = CORE_TOPICS.filter((topic) => !wasAsked(topic, askedText))
  const deepUnasked = DEEP_TOPICS.filter((topic) => !wasAsked(topic, askedText))
  const compareAsked = wasAsked(COMPARE_TOPIC, askedText)

  const selected: SuggestedTopic[] = []
  const targetLimit = hasRunnerUpCandidate && !compareAsked ? limit - 1 : limit

  selected.push(...coreUnasked.slice(0, targetLimit))

  if (selected.length < targetLimit && coreAsked.length > 0) {
    selected.push(...deepUnasked.slice(0, targetLimit - selected.length))
  }

  if (selected.length < targetLimit) {
    // Deep pool exhausted too — cycle back through already-asked core
    // topics rather than leaving the row empty (Visual Design System §12:
    // "never fully disappear").
    selected.push(...coreAsked.slice(0, targetLimit - selected.length))
  }

  if (hasRunnerUpCandidate && !compareAsked) {
    selected.push(COMPARE_TOPIC)
  }

  return selected.slice(0, limit)
}
