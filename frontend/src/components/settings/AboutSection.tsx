import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SectionCard } from '@/components/common/SectionCard'
import { Logo } from '@/components/common/Logo'

// The repo's actual git remote. License, docs, privacy-policy, and terms
// pages don't exist yet, so no links to them are shown (never dead links).
const GITHUB_URL = 'https://github.com/lukenoronha/leafmind'

function formatBuildDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function AboutSection() {
  const buildDate = formatBuildDate(__BUILD_DATE__)

  return (
    <SectionCard title="About" description="Version and project information.">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Logo imgClassName="size-9" wordmarkClassName="text-base" />
          </div>
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer noopener">
              GitHub Repository
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          AI-powered medicinal plant identification and knowledge assistant.
        </p>

        <Separator />

        <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
          <div className="flex items-center justify-between gap-3 sm:block sm:space-y-0.5">
            <dt className="text-muted-foreground">Version</dt>
            <dd className="text-foreground font-medium tabular-nums">
              v{__APP_VERSION__}
            </dd>
          </div>
          {buildDate ? (
            <div className="flex items-center justify-between gap-3 sm:block sm:space-y-0.5">
              <dt className="text-muted-foreground">Build date</dt>
              <dd className="text-foreground font-medium">{buildDate}</dd>
            </div>
          ) : null}
          {__GIT_COMMIT__ ? (
            <div className="flex items-center justify-between gap-3 sm:block sm:space-y-0.5">
              <dt className="text-muted-foreground">Commit</dt>
              <dd className="text-foreground font-mono font-medium">
                {__GIT_COMMIT__}
              </dd>
            </div>
          ) : null}
        </dl>

        <Separator />

        <p className="text-muted-foreground text-xs">
          Built with React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer
          Motion, and FastAPI.
        </p>
      </div>
    </SectionCard>
  )
}
