import { BadgeCheck, Cpu } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { Prediction } from '@/types/analysis'
import { cn } from '@/lib/utils'

interface PredictionCardProps {
  prediction: Prediction
  className?: string
}

function confidenceVariant(confidence: number) {
  if (confidence >= 0.85) return 'default'
  if (confidence >= 0.6) return 'secondary'
  return 'destructive'
}

export function PredictionCard({ prediction, className }: PredictionCardProps) {
  const confidencePercent = Math.round(prediction.confidence * 100)

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-xl">{prediction.plantName}</CardTitle>
            <CardDescription className="italic">
              {prediction.scientificName}
            </CardDescription>
          </div>
          <Badge variant={confidenceVariant(prediction.confidence)}>
            <BadgeCheck />
            {confidencePercent}% match
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <div className="text-muted-foreground flex items-center justify-between text-sm">
            <span>Confidence</span>
            <span className="text-foreground font-medium">
              {confidencePercent}%
            </span>
          </div>
          <Progress value={confidencePercent} />
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Predicted</dt>
            <dd className="text-foreground font-medium">
              {new Date(prediction.predictedAt).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground flex items-center gap-1">
              <Cpu className="size-3.5" />
              Model version
            </dt>
            <dd className="text-foreground font-medium">
              {prediction.modelVersion}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
