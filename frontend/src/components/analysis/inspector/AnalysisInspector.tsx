import { X } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ExplainabilityTab } from '@/components/analysis/inspector/ExplainabilityTab'
import { SourcesTab } from '@/components/analysis/inspector/SourcesTab'
import { useMinWidth } from '@/hooks/use-breakpoint'
import { cn } from '@/lib/utils'

export type InspectorTab = 'explainability' | 'sources'

interface AnalysisInspectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tab: InspectorTab
  onTabChange: (tab: InspectorTab) => void
  predictionId: string | null
  plantName: string
  className?: string
}

function InspectorBody({
  tab,
  onTabChange,
  predictionId,
  plantName,
}: Pick<
  AnalysisInspectorProps,
  'tab' | 'onTabChange' | 'predictionId' | 'plantName'
>) {
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => onTabChange(value as InspectorTab)}
      className="flex h-full min-h-0 flex-col gap-0"
    >
      <TabsList className="mx-4 mt-3">
        <TabsTrigger value="explainability">Explainability</TabsTrigger>
        <TabsTrigger value="sources">Sources</TabsTrigger>
      </TabsList>
      <TabsContent value="explainability" className="min-h-0 overflow-y-auto">
        <ExplainabilityTab plantName={plantName} />
      </TabsContent>
      <TabsContent value="sources" className="min-h-0 overflow-y-auto">
        {predictionId ? <SourcesTab predictionId={predictionId} /> : null}
      </TabsContent>
    </Tabs>
  )
}

/**
 * Explainability/Sources panel. Desktop (>=1024px) renders in-flow, sliding
 * in from the right and compressing the feed column rather than overlaying
 * it. Tablet (768-1023px) and mobile (<768px) both use the Sheet primitive
 * as a true overlay with a scrim — tablet from the right edge, mobile as a
 * bottom sheet.
 *
 * Only one variant is ever mounted at a time (branched on real viewport
 * width via matchMedia, not CSS visibility classes) — Sheet is a Radix
 * Dialog under the hood, so two simultaneously-open instances would each
 * install their own focus trap and Escape/outside-click handlers even if
 * one were merely hidden with `hidden md:flex`.
 */
export function AnalysisInspector({
  open,
  onOpenChange,
  tab,
  onTabChange,
  predictionId,
  plantName,
  className,
}: AnalysisInspectorProps) {
  const prefersReducedMotion = useReducedMotion()
  const isDesktop = useMinWidth(1024)
  const isTablet = useMinWidth(768)

  if (isDesktop) {
    return (
      <AnimatePresence>
        {open ? (
          <motion.aside
            aria-label="Explainability and sources"
            initial={
              prefersReducedMotion ? undefined : { width: 0, opacity: 0 }
            }
            animate={{ width: 380, opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { width: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            className={cn(
              'bg-card h-full shrink-0 overflow-hidden border-l',
              className,
            )}
          >
            <div className="flex h-full w-95 min-w-95 flex-col">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <p className="text-foreground text-sm font-semibold">
                  Explainability &amp; sources
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close inspector"
                >
                  <X />
                </Button>
              </div>
              <InspectorBody
                tab={tab}
                onTabChange={onTabChange}
                predictionId={predictionId}
                plantName={plantName}
              />
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isTablet ? 'right' : 'bottom'}
        className={cn(
          'gap-0 p-0',
          isTablet ? 'w-96 max-w-none' : 'flex h-[85svh] rounded-t-2xl',
        )}
      >
        <SheetHeader className="border-b py-3">
          <SheetTitle>Explainability &amp; sources</SheetTitle>
        </SheetHeader>
        <InspectorBody
          tab={tab}
          onTabChange={onTabChange}
          predictionId={predictionId}
          plantName={plantName}
        />
      </SheetContent>
    </Sheet>
  )
}
