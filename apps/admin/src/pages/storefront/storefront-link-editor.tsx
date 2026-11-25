import {
  storefrontLinkTargetBehaviorSchema,
  storefrontResourceKindSchema,
  type StorefrontLink,
  type StorefrontResourceReference,
} from '@shoppp/contracts'
import { Alert, Form, Input, Select } from 'antd'
import React, { useId } from 'react'
import { useI18n } from '../../shared/contexts/i18n-context'
import { resourceKindMessages } from './theme-feedback'
import { StorefrontFieldGroup } from './storefront-field-group'

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
  showLabel = true,
  value,
}: {
  disabled: boolean
  label: string
  onChange: (value: StorefrontLink) => void
  allowedTargets: Array<StorefrontResourceReference['kind'] | 'external'>
  resources: StorefrontEditorResource[]
  showLabel?: boolean
  value: StorefrontLink
}) => {
  const { t } = useI18n()
  const fieldId = useId()
  const reference = value.target.kind === 'internal' ? value.target.reference : null
  const allowedResources = resources.filter(({ kind }) => allowedTargets.includes(kind))
  const matchingResources = reference
    ? allowedResources.filter(({ kind }) => kind === reference.kind)
    : []
  const missingReference = reference && !matchingResources.some(({ id }) => id === reference.id)

  const setInternalKind = (kind: StorefrontResourceReference['kind']) => {
    const first = allowedResources.find((resource) => resource.kind === kind)
    if (!first) return
    onChange({
      ...value,
      target: { kind: 'internal', reference: { id: first.id, kind: first.kind } },
    })
  }

  return (
    <StorefrontFieldGroup label={label} showLabel={showLabel}>
      <div>
        <Form.Item layout="vertical" label={t('Link label')} htmlFor={`${fieldId}-label`}>
          <Input
            id={`${fieldId}-label`}
            aria-label={t('{label} label', { label })}
            disabled={disabled}
            maxLength={120}
            value={value.label}
            onChange={(event) => onChange({ ...value, label: event.target.value })}
          />
        </Form.Item>
        <Form.Item layout="vertical" label={t('Destination type')} htmlFor={`${fieldId}-type`}>
          <Select
            id={`${fieldId}-type`}
            aria-label={t('{label} destination type', { label })}
            className="w-full"
            disabled={disabled}
            value={value.target.kind}
            options={[
              ...(allowedResources.length > 0
                ? [{ label: t('Internal resource'), value: 'internal' }]
                : []),
              ...(allowedTargets.includes('external')
                ? [{ label: t('External HTTPS URL'), value: 'external' }]
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
        </Form.Item>
        {value.target.kind === 'internal' && reference ? (
          <>
            <Form.Item
              layout="vertical"
              label={t('Resource type')}
              htmlFor={`${fieldId}-resource-kind`}
            >
              <Select
                id={`${fieldId}-resource-kind`}
                aria-label={t('{label} resource type', { label })}
                className="w-full"
                disabled={disabled}
                value={reference.kind}
                options={storefrontResourceKindSchema.options
                  .filter((kind) => allowedTargets.includes(kind))
                  .map((kind) => ({
                    label: Object.hasOwn(resourceKindMessages, kind)
                      ? t(resourceKindMessages[kind])
                      : kind,
                    value: kind,
                  }))}
                onChange={setInternalKind}
              />
            </Form.Item>
            <Form.Item
              layout="vertical"
              label={t('Destination')}
              htmlFor={`${fieldId}-destination`}
            >
              <Select
                id={`${fieldId}-destination`}
                aria-label={t('{label} destination', { label })}
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
            </Form.Item>
            {missingReference ? (
              <Alert
                type="error"
                showIcon
                title={t('The selected destination is missing from the current release.')}
                description={t('Choose a replacement before preview or approval.')}
              />
            ) : null}
          </>
        ) : value.target.kind === 'external' ? (
          <Form.Item layout="vertical" label={t('HTTPS URL')} htmlFor={`${fieldId}-url`}>
            <Input
              id={`${fieldId}-url`}
              aria-label={t('{label} external URL', { label })}
              disabled={disabled}
              value={value.target.url}
              placeholder="https://example.com"
              onChange={(event) =>
                onChange({ ...value, target: { kind: 'external', url: event.target.value.trim() } })
              }
            />
          </Form.Item>
        ) : null}
        <Form.Item layout="vertical" label={t('Open behavior')} htmlFor={`${fieldId}-behavior`}>
          <Select
            id={`${fieldId}-behavior`}
            aria-label={t('{label} open behavior', { label })}
            className="w-full"
            disabled={disabled}
            value={value.targetBehavior}
            options={storefrontLinkTargetBehaviorSchema.options.map((targetBehavior) => ({
              label: t(targetBehaviorLabels[targetBehavior]),
              value: targetBehavior,
            }))}
            onChange={(targetBehavior) => onChange({ ...value, targetBehavior })}
          />
        </Form.Item>
      </div>
    </StorefrontFieldGroup>
  )
}
