import { FlaskConical, Leaf, MapPin, ShieldAlert, Sprout } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { HealthReport } from '@/types/analysis'
import { cn } from '@/lib/utils'

interface HealthReportCardProps {
  report: HealthReport
  className?: string
}

export function HealthReportCard({ report, className }: HealthReportCardProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Leaf className="text-primary size-5" />
          Botanical health report
        </CardTitle>
        <CardDescription>{report.summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <Sprout className="size-3.5" />
              Family
            </p>
            <p className="text-foreground font-medium">{report.family}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <MapPin className="size-3.5" />
              Native region
            </p>
            <p className="text-foreground font-medium">{report.nativeRegion}</p>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <p className="text-muted-foreground text-sm">Growth habit</p>
            <p className="text-foreground font-medium">{report.growthHabit}</p>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-foreground text-sm font-medium">
            Traditional medicinal uses
          </p>
          <div className="flex flex-wrap gap-1.5">
            {report.medicinalUses.map((use) => (
              <Badge key={use} variant="secondary">
                {use}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-foreground flex items-center gap-1.5 text-sm font-medium">
            <FlaskConical className="size-3.5" />
            Active compounds
          </p>
          <div className="flex flex-wrap gap-1.5">
            {report.activeCompounds.map((compound) => (
              <Badge key={compound} variant="outline">
                {compound}
              </Badge>
            ))}
          </div>
        </div>

        <div className="border-warning/30 bg-warning/10 flex items-start gap-2 rounded-lg border p-3 text-sm">
          <ShieldAlert className="text-warning mt-0.5 size-4 shrink-0" />
          <p className="text-foreground">{report.toxicityNotes}</p>
        </div>
      </CardContent>
    </Card>
  )
}
