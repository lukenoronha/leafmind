/** Triggers a browser download for in-memory content (JSON/text) or an
 * already-fetched Blob (e.g. a server-generated PDF) — shared by chat export
 * and report export so the download mechanics live in exactly one place. */
export function downloadBlob(
  content: string | Blob,
  filename: string,
  mimeType?: string,
) {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
