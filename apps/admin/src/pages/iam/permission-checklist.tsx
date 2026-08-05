import { ADMIN_PERMISSION_CATALOG, type AdminPermission } from '@shoppp/contracts'
import { Checkbox } from 'antd'
import React from 'react'
import { useI18n } from '../../shared/contexts/i18n-context'

void React

type PermissionChecklistProps = {
  disabled?: boolean
  onChange?: (value: AdminPermission[]) => void
  permitted: readonly AdminPermission[]
  value?: readonly AdminPermission[]
}

export const PermissionChecklist = ({
  disabled,
  onChange,
  permitted,
  value = [],
}: PermissionChecklistProps) => {
  const { t } = useI18n()
  const groups = new Map<string, (typeof ADMIN_PERMISSION_CATALOG)[number][]>()
  for (const permission of ADMIN_PERMISSION_CATALOG) {
    if (!permitted.includes(permission.key)) continue
    const entries = groups.get(permission.category) ?? []
    entries.push(permission)
    groups.set(permission.category, entries)
  }
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-label={t('Role permissions')}>
      {[...groups.entries()].map(([category, entries]) => (
        <fieldset key={category} className="rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-sm font-semibold capitalize">{t(category)}</legend>
          <div className="space-y-2">
            {entries.map((permission) => (
              <Checkbox
                key={permission.key}
                checked={value.includes(permission.key)}
                disabled={disabled}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...value, permission.key]
                    : value.filter((key) => key !== permission.key)
                  onChange?.(next)
                }}
              >
                <span className="font-medium">{t(permission.label)}</span>
                <span className="ml-2 text-xs text-slate-500">{t(permission.description)}</span>
              </Checkbox>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  )
}
