import {
  storefrontLinkTargetBehaviorSchema,
  storefrontResourceKindSchema,
  type StorefrontLink,
  type StorefrontResourceReference,
} from '@shoppp/contracts'
import { Alert, Input, Select, Space, Typography } from 'antd'
import React from 'react'

void React

export type StorefrontEditorResource = StorefrontResourceReference & {
  label: string
  path: string
}

const targetBehaviorLabels = {
  'new-window': 'New window',
  'same-window': 'Same window',
} as const

export const StorefrontLinkEditor = ({
  disabled,
  label,
  onChange,
  allowedTargets,
  resources,
  value,
}: {
  disabled: boolean
  label: string
  onChange: (value: StorefrontLink) => void
  allowedTargets: Array<StorefrontResourceReference['kind'] | 'external'>
  resources: StorefrontEditorResource[]
  value: StorefrontLink
}) => {
  const reference = value.target.kind === 'internal' ? value.target.reference : null
  const allowedResources = resources.filter(({ kind }) => allowedTargets.includes(kind))
  const matchingResources = reference
    ? allowedResources.filter(({ kind }) => kind === reference.kind)
    : []
  const missingReference =
    reference && !matchingResources.some(({ id }) => id === reference.id)

  const setInternalKind = (kind: StorefrontResourceReference['kind']) => {
    const first = allowedResources.find((resource) => resource.kind === kind)
    if (!first) return
    onChange({
      ...value,
      target: { kind: 'internal', reference: { id: first.id, kind: first.kind } },
    })
  }

  return (
    <fieldset aria-label={label} className="min-w-0 rounded border border-slate-200 p-3">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      <Space orientation="vertical" className="w-full">
        <label>
          <Typography.Text>Link label</Typography.Text>
          <Input
            aria-label={`${label} label`}
            disabled={disabled}
            maxLength={120}
            value={value.label}
            onChange={(event) => onChange({ ...value, label: event.target.value })}
          />
        </label>
        <label>
          <Typography.Text>Destination type</Typography.Text>
          <Select
            aria-label={`${label} destination type`}
            className="w-full"
            disabled={disabled}
            value={value.target.kind}
            options={[
              ...(allowedResources.length > 0
                ? [{ label: 'Internal resource', value: 'internal' }]
                : []),
              ...(allowedTargets.includes('external')
                ? [{ label: 'External HTTPS URL', value: 'external' }]
                : []),
            ]}
            onChange={(kind) => {
              if (kind === 'external') {
                onChange({
                  ...value,
                  target: { kind: 'external', url: 'https://example.com' },
                  targetBehavior: 'new-window',
                })
                return
              }
              const first = allowedResources[0]
              if (first) {
                onChange({
                  ...value,
                  target: { kind: 'internal', reference: { id: first.id, kind: first.kind } },
                  targetBehavior: 'same-window',
                })
              }
            }}
          />
        </label>
        {value.target.kind === 'internal' && reference ? (
          <>
            <label>
              <Typography.Text>Resource type</Typography.Text>
              <Select
                aria-label={`${label} resource type`}
                className="w-full"
                disabled={disabled}
                value={reference.kind}
                options={storefrontResourceKindSchema.options
                  .filter((kind) => allowedTargets.includes(kind))
                  .map((kind) => ({ label: kind, value: kind }))}
                onChange={setInternalKind}
              />
            </label>
            <label>
              <Typography.Text>Destination</Typography.Text>
              <Select
                aria-label={`${label} destination`}
                className="w-full"
                disabled={disabled || matchingResources.length === 0}
                showSearch
                optionFilterProp="label"
                value={missingReference ? undefined : reference.id}
                options={matchingResources.map((resource) => ({
                  label: `${resource.label} · ${resource.path}`,
                  value: resource.id,
                }))}
                onChange={(id) =>
                  onChange({
                    ...value,
                    target: { kind: 'internal', reference: { id, kind: reference.kind } },
                  })
                }
              />
            </label>
            {missingReference ? (
              <Alert
                type="error"
                showIcon
                title="The selected destination is missing from the current release."
                description="Choose a replacement before preview or approval."
              />
            ) : null}
          </>
        ) : value.target.kind === 'external' ? (
          <label>
            <Typography.Text>HTTPS URL</Typography.Text>
            <Input
              aria-label={`${label} external URL`}
              disabled={disabled}
              value={value.target.url}
              placeholder="https://example.com"
              onChange={(event) =>
                onChange({ ...value, target: { kind: 'external', url: event.target.value.trim() } })
              }
            />
          </label>
        ) : null}
        <label>
          <Typography.Text>Open behavior</Typography.Text>
          <Select
            aria-label={`${label} open behavior`}
            className="w-full"
            disabled={disabled}
            value={value.targetBehavior}
            options={storefrontLinkTargetBehaviorSchema.options.map((targetBehavior) => ({
              label: targetBehaviorLabels[targetBehavior],
              value: targetBehavior,
            }))}
            onChange={(targetBehavior) => onChange({ ...value, targetBehavior })}
          />
        </label>
      </Space>
    </fieldset>
  )
}
