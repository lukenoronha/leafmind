import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { AppSetting } from '@/types/admin'

interface SettingFieldProps {
  setting: AppSetting
  onSave: (value: AppSetting['value']) => void
  onReset: () => void
  disabled?: boolean
}

/** Input type is inferred client-side from the value's JS type — the
 * backend declares no explicit UI "type" field for these settings. */
function inferredType(value: AppSetting['value']): 'boolean' | 'number' | 'text' {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  return 'text'
}

export function SettingField({
  setting,
  onSave,
  onReset,
  disabled,
}: SettingFieldProps) {
  const [value, setValue] = useState(setting.value)
  const type = inferredType(setting.value)

  const isDirty = value !== setting.value

  function commit() {
    if (isDirty) onSave(value)
  }

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <Label htmlFor={setting.key} className="text-foreground">
            {setting.key}
          </Label>
          {setting.isOverridden ? (
            <Badge variant="secondary" className="text-xs">
              Overridden
            </Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground text-xs">{setting.description}</p>
        <p className="text-muted-foreground text-xs">
          Default: {String(setting.defaultValue)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="w-40">
          {type === 'boolean' ? (
            <Switch
              id={setting.key}
              checked={Boolean(value)}
              disabled={disabled}
              onCheckedChange={(checked) => {
                setValue(checked)
                onSave(checked)
              }}
            />
          ) : (
            <Input
              id={setting.key}
              type={type === 'number' ? 'number' : 'text'}
              value={String(value)}
              disabled={disabled}
              onChange={(event) =>
                setValue(
                  type === 'number'
                    ? Number(event.target.value)
                    : event.target.value,
                )
              }
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commit()
              }}
            />
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || !setting.isOverridden}
          onClick={onReset}
          aria-label={`Reset ${setting.key} to default`}
        >
          <RotateCcw className="size-4" />
        </Button>
      </div>
    </div>
  )
}
