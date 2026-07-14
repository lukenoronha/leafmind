import type { ChatMessage } from '@/types/analysis'

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function exportChatAsJson(
  plantName: string,
  predictionId: string,
  messages: ChatMessage[],
) {
  const payload = {
    plantName,
    predictionId,
    exportedAt: new Date().toISOString(),
    messages,
  }
  downloadBlob(
    JSON.stringify(payload, null, 2),
    `leafmind-chat-${predictionId}.json`,
    'application/json',
  )
}

export function exportChatAsMarkdown(
  plantName: string,
  predictionId: string,
  messages: ChatMessage[],
) {
  const lines = [`# Conversation about ${plantName}`, '']

  for (const message of messages) {
    const speaker = message.role === 'user' ? 'You' : 'LeafMind'
    lines.push(
      `### ${speaker} — ${new Date(message.createdAt).toLocaleString()}`,
    )
    lines.push('')
    lines.push(message.content)

    if (message.sources && message.sources.length > 0) {
      lines.push('')
      lines.push('**Sources:**')
      for (const source of message.sources) {
        lines.push(
          `- ${source.documentName}${source.chapter ? `, ${source.chapter}` : ''}${source.pageNumber !== null ? ` (p. ${source.pageNumber})` : ''} — ${Math.round(source.score * 100)}% match`,
        )
      }
    }
    lines.push('')
  }

  downloadBlob(
    lines.join('\n'),
    `leafmind-chat-${predictionId}.md`,
    'text/markdown',
  )
}
