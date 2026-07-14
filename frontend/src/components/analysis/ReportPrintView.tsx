import { useMemo } from 'react'
import logoSrc from '@/assets/images/logo.png'
import type {
  ChatMessage,
  Prediction,
  PredictionReport,
  Source,
} from '@/types/analysis'

interface ReportPrintViewProps {
  prediction: Prediction
  report: PredictionReport
  imageUrl?: string | null
  messages?: ChatMessage[]
}

function collectUniqueSources(messages: ChatMessage[] | undefined): Source[] {
  if (!messages) return []
  const seen = new Map<string, Source>()
  for (const message of messages) {
    for (const source of message.sources ?? []) {
      if (!seen.has(source.chunkId)) seen.set(source.chunkId, source)
    }
  }
  return [...seen.values()]
}

/**
 * Print-only report layout. Hidden on screen (`.print-only` is
 * `display: none` until @media print, see index.css) and rendered
 * alongside the interactive view so "Download PDF" can simply call
 * window.print() — the browser's print-to-PDF handles the rest.
 */
export function ReportPrintView({
  prediction,
  report,
  imageUrl,
  messages,
}: ReportPrintViewProps) {
  const sources = useMemo(() => collectUniqueSources(messages), [messages])
  const confidencePercent = Math.round(prediction.confidence * 100)

  return (
    <div className="print-only">
      <header className="mb-6 flex items-center justify-between border-b border-black pb-4">
        <div className="flex items-center gap-2">
          <img src={logoSrc} alt="LeafMind" className="h-8 w-8" />
          <span className="text-lg font-bold">LeafMind</span>
        </div>
        <div className="text-right text-xs text-neutral-600">
          <p>Medicinal Plant Identification Report</p>
          <p>Generated {new Date().toLocaleString()}</p>
        </div>
      </header>

      {imageUrl ? (
        <img
          src={imageUrl}
          alt={prediction.plantName}
          className="mb-4 max-h-64 w-full object-contain"
        />
      ) : null}

      <section className="mb-6">
        <h1 className="text-2xl font-bold">{prediction.plantName}</h1>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-neutral-600">Confidence</dt>
            <dd className="font-semibold">{confidencePercent}%</dd>
          </div>
          <div>
            <dt className="text-neutral-600">Model version</dt>
            <dd className="font-semibold">{prediction.modelVersion}</dd>
          </div>
          <div>
            <dt className="text-neutral-600">Predicted</dt>
            <dd className="font-semibold">
              {new Date(prediction.predictedAt).toLocaleString()}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-bold">
          Related knowledge base information
        </h2>
        {report.knowledgeAvailable ? (
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {report.relatedKnowledge.map((chunk, index) => (
              <li key={`${chunk.documentName}-${index}`}>
                <span className="font-semibold">{chunk.documentName}</span>
                {chunk.pageNumber !== null ? `, p. ${chunk.pageNumber}` : ''}
                {' — '}&ldquo;{chunk.text}&rdquo;
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm">
            No information about this species is available in the knowledge
            base.
          </p>
        )}
      </section>

      {sources.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold">Chat source references</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {sources.map((source) => (
              <li key={source.chunkId}>
                {source.documentName}
                {source.chapter ? `, ${source.chapter}` : ''}
                {source.pageNumber !== null
                  ? ` (p. ${source.pageNumber})`
                  : ''}{' '}
                &mdash; {Math.round(source.score * 100)}% retrieval score
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <footer className="mt-8 border-t border-black pt-3 text-xs text-neutral-600">
        <p>{report.disclaimer}</p>
      </footer>
    </div>
  )
}
