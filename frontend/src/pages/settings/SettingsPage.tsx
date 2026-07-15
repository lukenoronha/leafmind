import { motion, useReducedMotion } from 'framer-motion'
import { PageHeader } from '@/components/common/PageHeader'
import { Loader } from '@/components/common/Loader'
import { AppearanceSection } from '@/components/settings/AppearanceSection'
import { WorkspaceSection } from '@/components/settings/WorkspaceSection'
import { AiPreferencesSection } from '@/components/settings/AiPreferencesSection'
import { NotificationsSection } from '@/components/settings/NotificationsSection'
import { AccessibilitySection } from '@/components/settings/AccessibilitySection'
import { PrivacySection } from '@/components/settings/PrivacySection'
import { DeveloperSection } from '@/components/settings/DeveloperSection'
import { AboutSection } from '@/components/settings/AboutSection'
import { useAuth } from '@/hooks/use-auth'

const fadeInUp = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' as const } },
}

/**
 * Application settings — vertical grouped sections (ChatGPT/Cursor/Notion
 * style), not floating cards. Real controls: Theme, Animations / Reduced
 * Motion, Presentation Mode / Developer Mode, Keyboard Shortcuts, and
 * Clear Cache. Everything without backend support is disabled and marked
 * "Coming soon" — nothing is mocked.
 */
export default function SettingsPage() {
  const { user, isLoading } = useAuth()
  const prefersReducedMotion = useReducedMotion()

  if (!user) {
    // Behind auth guards — only reachable while the session bootstraps.
    return isLoading ? <Loader /> : null
  }

  const isDeveloperOrAdmin = user.role === 'developer' || user.role === 'admin'

  const containerMotion = prefersReducedMotion
    ? {}
    : {
        initial: 'hidden' as const,
        animate: 'show' as const,
        variants: {
          hidden: {},
          show: { transition: { staggerChildren: 0.04 } },
        },
      }
  const sectionMotion = prefersReducedMotion ? {} : { variants: fadeInUp }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your application preferences."
      />

      <motion.div {...containerMotion} className="space-y-4">
        <motion.div {...sectionMotion}>
          <AppearanceSection />
        </motion.div>
        <motion.div {...sectionMotion}>
          <WorkspaceSection />
        </motion.div>
        <motion.div {...sectionMotion}>
          <AiPreferencesSection />
        </motion.div>
        <motion.div {...sectionMotion}>
          <NotificationsSection />
        </motion.div>
        <motion.div {...sectionMotion}>
          <AccessibilitySection user={user} />
        </motion.div>
        <motion.div {...sectionMotion}>
          <PrivacySection />
        </motion.div>
        {isDeveloperOrAdmin ? (
          <motion.div {...sectionMotion}>
            <DeveloperSection user={user} />
          </motion.div>
        ) : null}
        <motion.div {...sectionMotion}>
          <AboutSection />
        </motion.div>
      </motion.div>
    </div>
  )
}
