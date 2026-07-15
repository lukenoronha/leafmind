import { GitCommitHorizontal, Globe, Server, Tag, TerminalSquare } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { SectionCard } from '@/components/common/SectionCard'
import { SettingRow } from '@/components/settings/SettingRow'
import { RoleBadge } from '@/components/user-hub/RoleBadge'
import { usePresentationMode } from '@/hooks/use-presentation-mode'
import { env } from '@/config/env'
import type { AuthUser } from '@/types/auth'

function ReadOnlyValue({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-muted text-foreground max-w-full truncate rounded-md px-2 py-1 font-mono text-xs">
      {children}
    </code>
  )
}

/**
 * Rendered only for developer/admin roles (gated by the caller). The
 * "Developer Mode" switch is the real inverse of the existing
 * Presentation Mode flag — the only mechanism in the app that shows or
 * hides developer chrome — not a new invented setting. The read-only rows
 * surface genuine runtime/build facts (env config and Vite defines).
 */
export function DeveloperSection({ user }: { user: AuthUser }) {
  const { isPresentationMode, setPresentationMode } = usePresentationMode()

  return (
    <SectionCard
      title="Developer"
      description="Diagnostics and environment details."
      action={<RoleBadge role={user.role} />}
    >
      <div className="space-y-3">
        <SettingRow
          icon={TerminalSquare}
          title="Developer Mode"
          description="Show developer navigation and tools. Turning this off enables Presentation Mode."
          control={
            <Switch
              checked={!isPresentationMode}
              onCheckedChange={(checked) => setPresentationMode(!checked)}
              aria-label="Toggle developer mode"
            />
          }
        />
        <Separator />
        <SettingRow
          icon={Server}
          title="API Endpoint"
          description="Backend URL this client talks to."
          control={<ReadOnlyValue>{env.apiBaseUrl}</ReadOnlyValue>}
        />
        <Separator />
        <SettingRow
          icon={Globe}
          title="Environment"
          description="Configured via VITE_APP_ENV."
          control={
            <ReadOnlyValue>
              <span className="capitalize">{env.appEnv}</span>
            </ReadOnlyValue>
          }
        />
        <Separator />
        <SettingRow
          icon={Tag}
          title="Version"
          description="Frontend package version."
          control={<ReadOnlyValue>v{__APP_VERSION__}</ReadOnlyValue>}
        />
        <Separator />
        <SettingRow
          icon={GitCommitHorizontal}
          title="Build"
          description="Git commit and build timestamp."
          control={
            <ReadOnlyValue>
              {__GIT_COMMIT__ ?? 'unknown'} ·{' '}
              {new Date(__BUILD_DATE__).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </ReadOnlyValue>
          }
        />
      </div>
    </SectionCard>
  )
}
