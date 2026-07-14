import { Settings2 } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { SettingField } from '@/components/admin/settings/SettingField'
import {
  useAdminSettings,
  useResetSetting,
  useUpdateSetting,
} from '@/hooks/use-admin-settings'

/**
 * The backend exposes a fixed allow-list of settings (rag_top_k,
 * rag_similarity_threshold, max_upload_size_mb, max_document_upload_size_mb,
 * session_timeout_minutes, default_model_version) — no category grouping,
 * so this renders one flat list rather than grouped sections.
 */
export function AdminSettingsPanel() {
  const { data, isLoading, isError, refetch } = useAdminSettings()
  const updateSetting = useUpdateSetting()
  const resetSetting = useResetSetting()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Application settings</CardTitle>
        <CardDescription>
          Configurable overrides for the RAG pipeline and upload limits.
          Changes are audit-logged.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Unable to load settings"
            description="We couldn't reach the settings endpoint."
            onRetry={() => void refetch()}
          />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={Settings2}
            title="No configurable settings"
            description="The backend hasn't exposed any settings yet."
          />
        ) : (
          <div className="divide-y">
            {data.map((setting) => (
              <SettingField
                key={setting.key}
                setting={setting}
                disabled={updateSetting.isPending || resetSetting.isPending}
                onSave={(value) =>
                  updateSetting.mutate({ key: setting.key, value })
                }
                onReset={() => resetSetting.mutate(setting.key)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
