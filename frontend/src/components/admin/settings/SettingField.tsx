import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AppSetting } from '@/types/admin'

interface SettingFieldProps {
  setting: AppSetting
  onSave: (value: AppSetting['value']) => void
  disabled?: boolean
}

export function SettingField({ setting, onSave, disabled }: SettingFieldProps) {
  const [value, setValue] = useState(setting.value)

  const isDirty = value !== setting.value

  function commit() {
    if (isDirty) onSave(value)
  }

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="space-y-0.5">
        <Label htmlFor={setting.key} className="text-foreground">
          {setting.label}
        </Label>
        <p className="text-muted-foreground text-xs">{setting.description}</p>
      </div>

      <div className="w-48 shrink-0">
        {setting.type === 'boolean' ? (
          <Switch
            id={setting.key}
            checked={Boolean(value)}
            disabled={disabled}
            onCheckedChange={(checked) => {
              setValue(checked)
              onSave(checked)
            }}
          />
        ) : setting.type === 'select' ? (
          <Select
            value={String(value)}
            disabled={disabled}
            onValueChange={(next) => {
              setValue(next)
              onSave(next)
            }}
          >
            <SelectTrigger id={setting.key} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {setting.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id={setting.key}
            type={setting.type === 'number' ? 'number' : 'text'}
            value={String(value)}
            disabled={disabled}
            onChange={(event) =>
              setValue(
                setting.type === 'number'
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
    </div>
  )
}
