import { PageHeader } from '@/components/common/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { KpiGrid } from '@/components/developer/KpiGrid'
import { PipelineVisualizer } from '@/components/developer/PipelineVisualizer'
import { PredictionAnalyticsPanel } from '@/components/developer/PredictionAnalyticsPanel'
import { RagAnalyticsPanel } from '@/components/developer/RagAnalyticsPanel'
import { PromptInspector } from '@/components/developer/PromptInspector'
import { LogsViewer } from '@/components/developer/LogsViewer'
import { SystemStatusGrid } from '@/components/developer/SystemStatusGrid'

export default function DeveloperPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Developer dashboard"
        description="Explainability and research transparency for LeafMind's identification and RAG pipeline."
      />

      <KpiGrid />

      <Tabs defaultValue="pipeline">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="prompts">Prompt inspector</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-6">
          <PipelineVisualizer />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <PredictionAnalyticsPanel />
          <RagAnalyticsPanel />
        </TabsContent>

        <TabsContent value="prompts">
          <PromptInspector />
        </TabsContent>

        <TabsContent value="logs">
          <LogsViewer />
        </TabsContent>

        <TabsContent value="system">
          <SystemStatusGrid />
        </TabsContent>
      </Tabs>
    </div>
  )
}
