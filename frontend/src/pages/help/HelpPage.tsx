import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  BookOpen,
  Database,
  ExternalLink,
  FileText,
  HelpCircle,
  ImagePlus,
  Keyboard,
  Leaf,
  Rocket,
  ScrollText,
  Search,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { SectionCard } from '@/components/common/SectionCard'
import { Logo } from '@/components/common/Logo'
import { KeyboardShortcutsDialog } from '@/components/user-hub/KeyboardShortcutsDialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { env } from '@/config/env'

// Every answer below describes only behavior that actually exists in the
// app today (identification pipeline, validation gates, RAG citations,
// print/chat exports) — nothing aspirational.
const FAQ_ITEMS = [
  {
    id: 'accuracy',
    question: 'How accurate is LeafMind?',
    answer:
      'Accuracy depends on photo quality and whether the species is part of the supported dataset. Every identification includes a confidence score, and results below the confidence threshold are clearly flagged as uncertain rather than presented as definitive. LeafMind is a research project — always verify medicinal usage with qualified professionals.',
  },
  {
    id: 'identification',
    question: 'How does the AI identify plants?',
    answer:
      'Your photo is first validated and preprocessed (denoising, contrast, resizing), then classified by a vision-language model that compares the leaf against the supported species list, aided by retrieval of visually similar labeled reference images. The result includes the top candidates, each with a confidence score and reasoning.',
  },
  {
    id: 'multiple-images',
    question: 'Can I upload multiple images?',
    answer:
      'Each analysis works on a single leaf photo, and images containing multiple leaves are rejected by the input validation step with a request for a clearer single-leaf shot. You can run as many separate analyses as you like — each appears in your History.',
  },
  {
    id: 'low-confidence',
    question: 'Why is confidence low?',
    answer:
      'Low confidence usually means the photo is blurry, poorly lit, or partially occluded — or the plant may not belong to the supported species dataset. Low-confidence results are flagged with a warning instead of being shown as a confident identification. A closer, well-lit photo of a single leaf usually helps.',
  },
  {
    id: 'citations',
    question: 'How are citations generated?',
    answer:
      'Answers in chat are grounded using Retrieval-Augmented Generation: your question is matched against reference documents indexed in a vector database, and the most relevant excerpts are provided to the model as context. Each grounded answer shows its numbered sources, including the document name and page number. If nothing relevant is found, LeafMind says so instead of guessing.',
  },
  {
    id: 'offline',
    question: 'Does LeafMind work offline?',
    answer:
      'No. Identification and chat both run on the LeafMind server, where the vision-language model and knowledge base live, so an internet connection is required.',
  },
  {
    id: 'export',
    question: 'Can I export reports?',
    answer:
      'Yes. After an identification you can use "Download PDF" to save the full report, and any conversation can be exported as Markdown or JSON from the Chat History page.',
  },
] as const

const DOCUMENTATION_ITEMS = [
  'User Guide',
  'API Documentation',
  'Research Paper',
  'Dataset Information',
  'Model Architecture',
  'Version History',
  'Developer Guide',
] as const

const ISSUE_TYPES = [
  'Bug Report',
  'Feature Request',
  'UI Feedback',
  'Dataset Issue',
  'Model Issue',
  'General Question',
] as const

const GITHUB_URL = 'https://github.com/lukenoronha/leafmind'

const fadeInUp = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' as const } },
}

function ComingSoonBadge() {
  return (
    <Badge variant="secondary" className="text-[0.65rem]">
      Coming soon
    </Badge>
  )
}

/**
 * Help Center — search (client-side, over the FAQ), quick-help cards that
 * deep-link into FAQ entries, documentation/resources listings, a feedback
 * form, contact, and about. Everything without real backing (docs, status
 * page, feedback endpoint) is visibly "Coming soon" and disabled rather
 * than mocked — same policy as the Settings page.
 */
export default function HelpPage() {
  const prefersReducedMotion = useReducedMotion()
  const [search, setSearch] = useState('')
  const [openFaqItem, setOpenFaqItem] = useState<string | undefined>()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [issueType, setIssueType] = useState<string | undefined>()
  const [issueMessage, setIssueMessage] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const faqSectionRef = useRef<HTMLDivElement>(null)

  // ⌘K / Ctrl+K focuses the help search, matching the hint shown in the box.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const filteredFaq = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return FAQ_ITEMS
    return FAQ_ITEMS.filter(
      (item) =>
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query),
    )
  }, [search])

  function openFaq(itemId?: string) {
    if (itemId) {
      setSearch('')
      setOpenFaqItem(itemId)
    }
    faqSectionRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
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
    <div className="mx-auto w-full max-w-275 space-y-6">
      <PageHeader
        title="Help & Feedback"
        description="Find answers, learn how LeafMind works, and contact the team."
      />

      <motion.div {...containerMotion} className="space-y-4">
        {/* Search */}
        <motion.div {...sectionMotion} className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            ref={searchInputRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search help articles..."
            aria-label="Search help articles"
            className="h-11 pr-16 pl-9"
          />
          <kbd
            aria-hidden="true"
            className="bg-muted text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded border px-1.5 py-0.5 font-mono text-[0.65rem]"
          >
            ⌘K
          </kbd>
        </motion.div>

        {/* Quick help */}
        <motion.div {...sectionMotion}>
          <div className="grid gap-3 sm:grid-cols-2">
            <QuickHelpCard
              icon={BookOpen}
              title="Getting Started"
              description="Learn how to identify medicinal plants."
              buttonLabel="Open Guide"
              comingSoon
            />
            <QuickHelpCard
              icon={Leaf}
              title="How Identification Works"
              description="Understand the AI prediction pipeline."
              buttonLabel="Read More"
              onClick={() => openFaq('identification')}
            />
            <QuickHelpCard
              icon={Database}
              title="Knowledge Base"
              description="Learn how retrieval and citations work."
              buttonLabel="Documentation"
              onClick={() => openFaq('citations')}
            />
            <QuickHelpCard
              icon={HelpCircle}
              title="Frequently Asked Questions"
              description="Browse common questions."
              buttonLabel="View FAQ"
              onClick={() => openFaq()}
            />
          </div>
        </motion.div>

        {/* Documentation */}
        <motion.div {...sectionMotion}>
          <SectionCard
            title="Documentation"
            description="Guides and reference material for LeafMind."
          >
            <ul className="divide-border divide-y">
              {DOCUMENTATION_ITEMS.map((name) => (
                <li
                  key={name}
                  className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <span className="text-foreground flex items-center gap-2 text-xs">
                    <FileText
                      className="text-muted-foreground size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    {name}
                  </span>
                  <ComingSoonBadge />
                </li>
              ))}
            </ul>
          </SectionCard>
        </motion.div>

        {/* FAQ */}
        <motion.div {...sectionMotion} ref={faqSectionRef} className="scroll-mt-4">
          <SectionCard
            title="Frequently Asked Questions"
            description="Common questions about identification, citations, and exports."
            action={
              search.trim() ? (
                <Badge variant="secondary" className="text-[0.65rem]">
                  {filteredFaq.length} match{filteredFaq.length === 1 ? '' : 'es'}
                </Badge>
              ) : undefined
            }
          >
            {filteredFaq.length === 0 ? (
              <p className="text-muted-foreground py-2 text-xs">
                No help articles match &ldquo;{search.trim()}&rdquo;. Try a
                different search term.
              </p>
            ) : (
              <Accordion
                type="single"
                collapsible
                value={openFaqItem}
                onValueChange={(value) => setOpenFaqItem(value || undefined)}
              >
                {filteredFaq.map((item) => (
                  <AccordionItem key={item.id} value={item.id}>
                    <AccordionTrigger className="text-xs">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-xs leading-relaxed">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </SectionCard>
        </motion.div>

        {/* Report an issue */}
        <motion.div {...sectionMotion}>
          <SectionCard
            title="Report an Issue"
            description="Feedback submission isn't wired to the backend yet — the form is preview-only."
          >
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="issue-type" className="text-xs">
                    Issue type
                  </Label>
                  <Select value={issueType} onValueChange={setIssueType}>
                    <SelectTrigger id="issue-type" className="w-full">
                      <SelectValue placeholder="Select an issue type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ISSUE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="issue-screenshot">
                    Attach screenshot
                  </Label>
                  <Button
                    id="issue-screenshot"
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    disabled
                    title="Screenshot attachments are coming soon"
                  >
                    <ImagePlus className="size-3.5" aria-hidden="true" />
                    Upload image
                    <Badge variant="secondary" className="ml-auto text-[0.65rem]">
                      Coming soon
                    </Badge>
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="issue-message" className="text-xs">
                  Message
                </Label>
                <Textarea
                  id="issue-message"
                  value={issueMessage}
                  onChange={(event) => setIssueMessage(event.target.value)}
                  placeholder="Describe the issue or share your feedback..."
                  rows={4}
                  className="resize-none text-sm"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <ComingSoonBadge />
                <Button
                  type="button"
                  size="sm"
                  disabled
                  title="Feedback submission is coming soon — there's no backend endpoint for it yet"
                >
                  Submit Feedback
                </Button>
              </div>
            </div>
          </SectionCard>
        </motion.div>

        {/* Resources */}
        <motion.div {...sectionMotion}>
          <SectionCard
            title="Resources"
            description="Shortcuts, status, and project references."
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <ResourceTile
                icon={Keyboard}
                label="Keyboard Shortcuts"
                onClick={() => setShortcutsOpen(true)}
              />
              <ResourceTile icon={Rocket} label="System Status" comingSoon />
              <ResourceTile icon={ScrollText} label="Release Notes" comingSoon />
              <ResourceTile
                icon={FileText}
                label="Project Documentation"
                comingSoon
              />
            </div>
          </SectionCard>
        </motion.div>

        {/* Contact */}
        <motion.div {...sectionMotion}>
          <SectionCard
            title="Contact"
            description="Where to find the project and its source."
          >
            <dl className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Project</dt>
                <dd className="text-foreground font-medium">
                  LeafMind · Research project
                </dd>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">GitHub Repository</dt>
                <dd>
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-primary focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded font-medium outline-none hover:underline focus-visible:ring-2"
                  >
                    lukenoronha/leafmind
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                </dd>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Documentation</dt>
                <dd>
                  <ComingSoonBadge />
                </dd>
              </div>
            </dl>
          </SectionCard>
        </motion.div>

        {/* About */}
        <motion.div {...sectionMotion}>
          <SectionCard title="About LeafMind">
            <div className="space-y-4">
              <Logo imgClassName="size-9" wordmarkClassName="text-base" />
              <p className="text-muted-foreground text-xs leading-relaxed">
                LeafMind is an AI-powered medicinal plant identification system
                that combines Vision-Language Models with Retrieval-Augmented
                Generation to provide plant identification, medicinal
                knowledge, and evidence-backed responses.
              </p>
              <Separator />
              <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
                <div className="flex items-center justify-between gap-3 sm:block sm:space-y-0.5">
                  <dt className="text-muted-foreground">Version</dt>
                  <dd className="text-foreground font-medium tabular-nums">
                    v{__APP_VERSION__}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 sm:block sm:space-y-0.5">
                  <dt className="text-muted-foreground">Build</dt>
                  <dd className="text-foreground font-mono font-medium">
                    {__GIT_COMMIT__ ?? '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 sm:block sm:space-y-0.5">
                  <dt className="text-muted-foreground">Environment</dt>
                  <dd className="text-foreground font-medium capitalize">
                    {env.appEnv}
                  </dd>
                </div>
              </dl>
              <Separator />
              <p className="text-muted-foreground text-xs">
                &copy; {new Date().getFullYear()} LeafMind. All rights
                reserved.
              </p>
            </div>
          </SectionCard>
        </motion.div>
      </motion.div>

      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
    </div>
  )
}

function QuickHelpCard({
  icon: Icon,
  title,
  description,
  buttonLabel,
  onClick,
  comingSoon,
}: {
  icon: LucideIcon
  title: string
  description: string
  buttonLabel: string
  onClick?: () => void
  comingSoon?: boolean
}) {
  return (
    <SectionCard className="h-full gap-3">
      <div className="flex flex-1 flex-col gap-2 px-5">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
            <Icon className="size-4" aria-hidden="true" />
          </div>
          <h2 className="text-foreground text-sm font-semibold">{title}</h2>
        </div>
        <p className="text-muted-foreground text-xs">{description}</p>
        <div className="mt-auto flex items-center gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onClick}
            disabled={comingSoon}
            title={comingSoon ? 'Coming soon' : undefined}
          >
            {buttonLabel}
          </Button>
          {comingSoon ? <ComingSoonBadge /> : null}
        </div>
      </div>
    </SectionCard>
  )
}

function ResourceTile({
  icon: Icon,
  label,
  onClick,
  comingSoon,
}: {
  icon: LucideIcon
  label: string
  onClick?: () => void
  comingSoon?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={comingSoon}
      title={comingSoon ? 'Coming soon' : undefined}
      className="hover:bg-accent focus-visible:ring-ring/50 flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left outline-none transition-colors focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-60"
    >
      <Icon className="text-muted-foreground size-4" aria-hidden="true" />
      <span className="text-foreground text-xs font-medium">{label}</span>
      {comingSoon ? <ComingSoonBadge /> : null}
    </button>
  )
}
