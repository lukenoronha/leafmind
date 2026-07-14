import { PageHeader } from '@/components/common/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdminKpiGrid } from '@/components/admin/AdminKpiGrid'
import { UserManagementPanel } from '@/components/admin/users/UserManagementPanel'
import { DatasetManagementPanel } from '@/components/admin/datasets/DatasetManagementPanel'
import { KnowledgeBasePanel } from '@/components/admin/knowledge/KnowledgeBasePanel'
import { EmbeddingManagementPanel } from '@/components/admin/embeddings/EmbeddingManagementPanel'
import { AdminSystemStatusGrid } from '@/components/admin/system/AdminSystemStatusGrid'
import { AdminSettingsPanel } from '@/components/admin/settings/AdminSettingsPanel'
import { ActivityLogsPanel } from '@/components/admin/logs/ActivityLogsPanel'

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin console"
        description="Manage users, datasets, the knowledge base, and platform configuration."
      />

      <AdminKpiGrid />

      <Tabs defaultValue="users">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="datasets">Datasets</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge base</TabsTrigger>
          <TabsTrigger value="embeddings">Embeddings</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="logs">Activity logs</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UserManagementPanel />
        </TabsContent>

        <TabsContent value="datasets">
          <DatasetManagementPanel />
        </TabsContent>

        <TabsContent value="knowledge">
          <KnowledgeBasePanel />
        </TabsContent>

        <TabsContent value="embeddings">
          <EmbeddingManagementPanel />
        </TabsContent>

        <TabsContent value="system">
          <AdminSystemStatusGrid />
        </TabsContent>

        <TabsContent value="settings">
          <AdminSettingsPanel />
        </TabsContent>

        <TabsContent value="logs">
          <ActivityLogsPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
