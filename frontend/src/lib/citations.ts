const CITATION_PATTERN = /\[(\d+)\]/g

export const CITATION_HREF_PREFIX = '#citation-'

/**
 * Rewrites bracketed citation markers like "[1]" into markdown links
 * pointing at a "#citation-n" fragment, so react-markdown parses them
 * as normal links. A fragment-only href has no colon before the `/`,
 * `?`, or `#`, so react-markdown's default URL sanitizer treats it as
 * relative and passes it through untouched (a custom scheme like
 * "citation:1" gets silently stripped to "" instead — sanitizeUrl only
 * allows http(s)/irc(s)/mailto/xmpp). ChatMessageBubble then overrides
 * link rendering to turn these into clickable citation badges instead
 * of real anchors.
 */
export function linkifyCitations(content: string, maxIndex: number): string {
  if (maxIndex <= 0) return content
  return content.replace(CITATION_PATTERN, (match, digits: string) => {
    const index = Number(digits)
    if (index < 1 || index > maxIndex) return match
    return `[${index}](${CITATION_HREF_PREFIX}${index})`
  })
}
