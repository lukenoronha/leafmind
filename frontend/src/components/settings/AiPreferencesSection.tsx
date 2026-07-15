import { BookOpenCheck, Bot, MessageSquareText, Thermometer } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { SectionCard } from '@/components/common/SectionCard'
import { SettingRow } from '@/components/settings/SettingRow'
import { DisabledSelect } from '@/components/settings/DisabledSelect'

// Genuine backend values (backend/app/core/config.py): the disabled
// controls preview real current behavior, never invented numbers.
// VLM_MODEL_NAME = "Qwen/Qwen2.5-VL-3B-Instruct", VLM_TEMPERATURE = 0.2.
const CURRENT_MODEL = 'Qwen2.5-VL-3B-Instruct'
const CURRENT_TEMPERATURE = 0.2

/**
 * None of these are user-configurable yet — the backend exposes no
 * per-user AI settings, and retrieval-augmented generation is always on
 * with no enable/disable flag anywhere in the API — so every control is
 * disabled and shows the genuine current behavior.
 */
export function AiPreferencesSection() {
  return (
    <SectionCard
      title="AI Preferences"
      description="How the assistant answers your questions."
    >
      <div className="space-y-3">
        <SettingRow
          icon={MessageSquareText}
          title="Response Style"
          description="How detailed the assistant's answers are."
          comingSoon
          control={
            <DisabledSelect
              value="balanced"
              ariaLabel="Response style"
              options={[
                { value: 'concise', label: 'Concise' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'detailed', label: 'Detailed' },
              ]}
            />
          }
        />
        <Separator />
        <SettingRow
          icon={Thermometer}
          title="Temperature"
          description={`Sampling creativity. Currently fixed at ${CURRENT_TEMPERATURE}.`}
          comingSoon
          control={
            <div
              className="flex w-40 items-center gap-2"
              title="Available after backend integration"
            >
              <Slider
                value={[CURRENT_TEMPERATURE]}
                min={0}
                max={1}
                step={0.05}
                disabled
                aria-label="Temperature (coming soon)"
              />
              <span className="text-muted-foreground w-7 shrink-0 text-right text-xs tabular-nums">
                {CURRENT_TEMPERATURE}
              </span>
            </div>
          }
        />
        <Separator />
        <SettingRow
          icon={Bot}
          title="Model"
          description="The vision-language model behind identifications."
          comingSoon
          control={
            <DisabledSelect
              value="qwen"
              ariaLabel="Model"
              className="w-52"
              options={[{ value: 'qwen', label: CURRENT_MODEL }]}
            />
          }
        />
        <Separator />
        <SettingRow
          icon={BookOpenCheck}
          title="Retrieval-Augmented Answers"
          description="Answers are grounded in the plant knowledge base. Always on."
          comingSoon
          control={
            <Switch
              checked
              disabled
              aria-label="Retrieval-augmented answers (always on, toggle coming soon)"
            />
          }
        />
      </div>
    </SectionCard>
  )
}
