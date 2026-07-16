import type { AnalysisSession, PredictionReport } from '@/types/analysis'
import { downloadBlob } from '@/lib/download'

/** Client-side JSON export of a saved report — no backend endpoint for this
 * (PDF is server-generated instead; see analysisService.getPredictionReportPdf),
 * so this only serializes data already fetched for the report detail view. */
export function exportReportAsJson(
  session: AnalysisSession,
  report: PredictionReport,
) {
  const payload = {
    predictionId: session.id,
    plantName: session.prediction.plantName,
    confidence: session.prediction.confidence,
    status: session.prediction.status,
    predictedAt: session.createdAt,
    saved: session.saved,
    originalFilename: session.image.originalFilename,
    disclaimer: report.disclaimer,
    knowledgeAvailable: report.knowledgeAvailable,
    relatedKnowledge: report.relatedKnowledge,
    exportedAt: new Date().toISOString(),
  }
  downloadBlob(
    JSON.stringify(payload, null, 2),
    `leafmind-report-${session.id}.json`,
    'application/json',
  )
}

export function downloadReportPdf(blob: Blob, predictionId: string) {
  downloadBlob(blob, `leafmind-report-${predictionId}.pdf`)
}
