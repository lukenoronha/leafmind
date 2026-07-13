import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfidenceBadge } from '@/components/analysis/ConfidenceBadge'
import { usePredictionAnalytics } from '@/hooks/use-developer-dashboard'
import { BarChart3 } from 'lucide-react'

export function PredictionAnalyticsPanel() {
  const { data, isLoading, isError, refetch } = usePredictionAnalytics()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prediction analytics</CardTitle>
        <CardDescription>
          Confidence, latency, and processing time for recent identifications.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Unable to load prediction analytics"
            description="We couldn't reach the analytics endpoint."
            onRetry={() => void refetch()}
          />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No predictions yet"
            description="Prediction analytics will appear here once requests come in."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plant</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Processing time</TableHead>
                <TableHead>Model version</TableHead>
                <TableHead>Predicted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-foreground font-medium">
                    {entry.plantName}
                  </TableCell>
                  <TableCell>
                    <ConfidenceBadge value={entry.confidence} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.latencyMs}ms
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.processingTimeMs}ms
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.modelVersion}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(entry.predictedAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
