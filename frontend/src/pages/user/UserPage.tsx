import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { motion, useReducedMotion } from 'framer-motion'
import { PageHeader } from '@/components/common/PageHeader'
import { Loader } from '@/components/common/Loader'
import { SectionCard } from '@/components/common/SectionCard'
import { CardContent } from '@/components/ui/card'
import { ProfileSummaryCard } from '@/components/profile/ProfileSummaryCard'
import { ProfileInformationCard } from '@/components/profile/ProfileInformationCard'
import { PreferencesCard } from '@/components/profile/PreferencesCard'
import { SecurityCard } from '@/components/profile/SecurityCard'
import { UsageStatsGrid } from '@/components/profile/UsageStatsGrid'
import { DangerZoneCard } from '@/components/profile/DangerZoneCard'
import { useAuth } from '@/hooks/use-auth'
import { ROUTES } from '@/routes/paths'

const fadeInUp = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' as const } },
}

/**
 * Profile page — the User Hub's "Profile" destination. Two-column on
 * desktop (identity summary left, editable details right), single column
 * below `lg`. Every control is wired to a real backend endpoint or
 * explicitly disabled with a "Coming soon" marker; nothing is mocked.
 */
export default function UserPage() {
  const { user, logout, isLoading } = useAuth()
  const navigate = useNavigate()
  const nameInputRef = useRef<HTMLInputElement>(null)
  const prefersReducedMotion = useReducedMotion()

  if (!user) {
    // The route sits behind auth guards, so this only shows while the
    // current-user query is still bootstrapping.
    return isLoading ? <Loader /> : null
  }

  async function handleLogout() {
    await logout()
    toast.success('You have been signed out.')
    navigate(ROUTES.login, { replace: true })
  }

  function focusNameField() {
    nameInputRef.current?.focus()
    nameInputRef.current?.scrollIntoView({
      block: 'center',
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }

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
        title="Profile"
        description="Manage your account, preferences, and security."
      />

      <motion.div
        {...containerMotion}
        className="grid items-start gap-4 lg:grid-cols-[300px_1fr] lg:gap-6"
      >
        {/* Left — identity summary + account information */}
        <motion.div {...sectionMotion} className="lg:sticky lg:top-6">
          <SectionCard>
            <CardContent className="px-5">
              <ProfileSummaryCard user={user} onEditProfile={focusNameField} />
            </CardContent>
          </SectionCard>
        </motion.div>

        {/* Right — editable details */}
        <div className="min-w-0 space-y-4">
          <motion.div {...sectionMotion}>
            <SectionCard
              title="Profile Information"
              description="Your public details across LeafMind."
            >
              <ProfileInformationCard user={user} nameInputRef={nameInputRef} />
            </SectionCard>
          </motion.div>

          <motion.div {...sectionMotion}>
            <SectionCard
              title="Preferences"
              description="Appearance and behavior."
            >
              <PreferencesCard user={user} />
            </SectionCard>
          </motion.div>

          <motion.div {...sectionMotion}>
            <SectionCard
              title="Security"
              description="Password and sign-in protection."
            >
              <SecurityCard />
            </SectionCard>
          </motion.div>

          <motion.div {...sectionMotion}>
            <SectionCard
              title="Usage"
              description="Your activity across LeafMind."
            >
              <UsageStatsGrid />
            </SectionCard>
          </motion.div>

          <motion.div {...sectionMotion}>
            <SectionCard
              title="Danger Zone"
              className="border-destructive/30"
              titleClassName="text-destructive"
            >
              <DangerZoneCard onLogout={() => void handleLogout()} />
            </SectionCard>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}
