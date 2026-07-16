import {
  Bookmark,
  BookmarkX,
  Download,
  ExternalLink,
  FileJson,
  MoreVertical,
  Share2,
  Trash2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PredictionConfidenceBadge } from '@/components/analysis/chat/PredictionConfidenceBadge'
import type { AnalysisSession } from '@/types/analysis'

interface SavedReportCardProps {
  session: AnalysisSession
  onOpenReport: (session: AnalysisSession) => void
  onOpenAnalysis: (session: AnalysisSession) => void
  onDownloadPdf: (session: AnalysisSession) => void
  onExportJson: (session: AnalysisSession) => void
  onUnsave: (session: AnalysisSession) => void
  onDelete: (session: AnalysisSession) => void
  isDownloadingPdf: boolean
  isExportingJson: boolean
}

/**
 * A saved report's card. No plant image thumbnail or scientific name — the
 * backend doesn't serve leaf photos back by URL and has no scientific-name
 * field (see types/analysis.ts), so neither is fabricated here. "Share" is
 * disabled — there's no share/link-generation endpoint.
 */
export function SavedReportCard({
  session,
  onOpenReport,
  onOpenAnalysis,
  onDownloadPdf,
  onExportJson,
  onUnsave,
  onDelete,
  isDownloadingPdf,
  isExportingJson,
}: SavedReportCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onOpenReport(session)}
            className="focus-visible:ring-ring/50 min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-2"
          >
            <h3 className="text-foreground truncate text-sm font-semibold">
              {session.prediction.plantName}
            </h3>
            <p className="text-muted-foreground truncate text-xs">
              {session.image.originalFilename}
            </p>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${session.prediction.plantName} report`}
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onOpenReport(session)}>
                <ExternalLink />
                Open Report
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onOpenAnalysis(session)}>
                <ExternalLink />
                Open Analysis
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isDownloadingPdf}
                onSelect={() => onDownloadPdf(session)}
              >
                <Download />
                {isDownloadingPdf ? 'Preparing PDF...' : 'Download PDF'}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isExportingJson}
                onSelect={() => onExportJson(session)}
              >
                <FileJson />
                Export JSON
              </DropdownMenuItem>
              <DropdownMenuItem disabled title="Sharing isn't supported yet">
                <Share2 />
                Share
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onUnsave(session)}>
                <BookmarkX />
                Unsave
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => onDelete(session)}
              >
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <PredictionConfidenceBadge value={session.prediction.confidence} />
          {session.prediction.status === 'low_confidence' ? (
            <Badge variant="outline" className="text-[0.7rem]">
              Needs review
            </Badge>
          ) : null}
        </div>

        <p className="text-muted-foreground text-xs">
          Identified {new Date(session.createdAt).toLocaleDateString()}
        </p>

        <button
          type="button"
          onClick={() => onOpenReport(session)}
          className="text-primary focus-visible:ring-ring/50 self-start rounded text-xs font-medium outline-none hover:underline focus-visible:ring-2"
        >
          <span className="inline-flex items-center gap-1">
            <Bookmark className="size-3" aria-hidden="true" />
            View report
          </span>
        </button>
      </CardContent>
    </Card>
  )
}
