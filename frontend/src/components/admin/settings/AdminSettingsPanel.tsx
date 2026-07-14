import { Settings2 } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { SettingField } from '@/components/admin/settings/SettingField'
import { useAdminSettings, useUpdateSetting } from '@/hooks/use-admin-settings'

export function AdminSettingsPanel() {
  const { data, isLoading, isError, refetch } = useAdminSettings()
  const updateSetting = useUpdateSetting()

  const grouped = data?.reduce<Record<string, typeof data>>((acc, setting) => {
    acc[setting.category] = [...(acc[setting.category] ?? []), setting]
    return acc
  }, {})

  return (
    <Card>
      <CardHeader>
        <CardTitle>Application settings</CardTitle>
        <CardDescription>
          Configuration exposed by the backend. Changes apply immediately.
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
        ) : !grouped || Object.keys(grouped).length === 0 ? (
          <EmptyState
            icon={Settings2}
            title="No configurable settings"
            description="The backend hasn't exposed any settings yet."
          />
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, settings]) => (
              <div key={category}>
                <h3 className="text-foreground mb-1 text-sm font-semibold">
                  {category}
                </h3>
                <Separator className="mb-1" />
                <div className="divide-y">
                  {settings.map((setting) => (
                    <SettingField
                      key={setting.key}
                      setting={setting}
                      disabled={updateSetting.isPending}
                      onSave={(value) =>
                        updateSetting.mutate({ key: setting.key, value })
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
