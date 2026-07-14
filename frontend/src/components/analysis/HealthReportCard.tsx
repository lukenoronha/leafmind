import { BookOpen, Leaf } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { PredictionReport } from '@/types/analysis'
import { cn } from '@/lib/utils'

interface HealthReportCardProps {
  report: PredictionReport
  className?: string
}

/**
 * Shows knowledge-base excerpts related to the predicted species, grounded
 * in whatever documents have actually been indexed via the RAG pipeline —
 * never fabricated medicinal claims. If nothing relevant is indexed, this
 * says so explicitly rather than inventing content (see
 * backend/app/services/reports/service.py's disclaimer/knowledge_available
 * contract).
 */
export function HealthReportCard({ report, className }: HealthReportCardProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Leaf className="text-primary size-5" />
          Related knowledge base information
        </CardTitle>
        <CardDescription>{report.disclaimer}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {report.knowledgeAvailable ? (
          report.relatedKnowledge.map((chunk, index) => (
            <div
              key={`${chunk.documentName}-${index}`}
              className="bg-muted/50 space-y-1 rounded-lg border p-3 text-sm"
            >
              <p className="text-foreground flex items-center gap-1.5 font-medium">
                <BookOpen className="size-3.5" />
                {chunk.documentName}
                {chunk.pageNumber !== null ? `, p. ${chunk.pageNumber}` : ''}
              </p>
              <p className="text-muted-foreground italic">
                &ldquo;{chunk.text}&rdquo;
              </p>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">
            No information about this species is available in the knowledge
            base yet.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
