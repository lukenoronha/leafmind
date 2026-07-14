import { Sparkles } from 'lucide-react'

interface ExplainabilityTabProps {
  plantName: string
}

/**
 * Honest placeholder — GradCAM/attention-map extraction doesn't exist
 * anywhere in the backend today (confirmed absent from both the frontend
 * and the inference pipeline). This says so plainly rather than fabricating
 * a heatmap or a "why" explanation the model never actually produced.
 */
export function ExplainabilityTab({ plantName }: ExplainabilityTabProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <Sparkles className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-foreground text-sm font-medium">
          Explainability is coming soon
        </p>
        <p className="text-muted-foreground text-sm">
          I don&apos;t yet have a way to visually show what led me to identify
          this as {plantName}. When this is available, you&apos;ll see the
          specific regions of your photo that most influenced the result.
        </p>
      </div>
    </div>
  )
}
