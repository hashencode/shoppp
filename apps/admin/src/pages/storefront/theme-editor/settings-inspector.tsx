import React, { useId } from 'react'
import { Button, Form, Input, InputNumber, Select, Switch } from 'antd'
import type {
  AssetReference,
  ExperienceResourceBinding,
  PageTemplate,
  SettingDefinition,
  StorefrontLink,
} from '@shoppp/contracts'
import { useI18n } from '../../../shared/contexts/i18n-context'
import { CatalogMediaPicker } from '../catalog-media-picker'
import { StorefrontResourcePicker } from '../storefront-resource-picker'
import { StorefrontLinkEditor, type StorefrontEditorResource } from '../storefront-link-editor'

void React
type Value = PageTemplate['sections'][number]['settings'][string]
type Props = {
  menus?: Array<{ id: string; placement: 'header' | 'footer' }>
  errors?: Record<string, string>
  onClear?: (settingId: string) => void
  instanceId: string
  definitions: SettingDefinition[]
  settings: Record<string, Value>
  bindings: ExperienceResourceBinding[]
  releaseId: string
  disabled: boolean
  block: boolean
  resources: StorefrontEditorResource[]
  onChange: (settingId: string, value: Value, group?: boolean) => void
  onReference: (settingId: string, kind: 'product' | 'collection', id?: string) => void
}

export const SettingsInspector = (props: Props) => {
  const { t } = useI18n()
  const prefix = useId()
  return (
    <Form layout="vertical" component="div">
      {props.definitions.map((definition) => {
        const value = props.settings[definition.id]
        const label = t(definition.label ?? definition.id)
        const id = `${prefix}-${definition.id}`
        const common = {
          id,
          disabled: props.disabled,
          'aria-label': label,
          'aria-invalid': Boolean(props.errors?.[definition.id]),
          'aria-describedby': props.errors?.[definition.id] ? `${id}-error` : undefined,
        }
        let control: React.ReactNode
        if (definition.kind === 'text')
          control = (
            <Input.TextArea
              {...common}
              autoSize={{ minRows: 1, maxRows: 6 }}
              maxLength={definition.maxLength}
              value={typeof value === 'string' ? value : ''}
              onChange={(event) => props.onChange(definition.id, event.target.value, true)}
            />
          )
        else if (definition.kind === 'number')
          control = (
            <InputNumber
              {...common}
              className="w-full"
              min={definition.min}
              max={definition.max}
              step={definition.step}
              value={
                typeof value === 'number' ? value : value === undefined ? definition.default : null
              }
              onChange={(next) => props.onChange(definition.id, next ?? '')}
            />
          )
        else if (definition.kind === 'boolean')
          control = (
            <Switch
              {...common}
              checked={typeof value === 'boolean' ? value : definition.default}
              onChange={(next) => props.onChange(definition.id, next)}
            />
          )
        else if (definition.kind === 'select')
          control = (
            <Select
              {...common}
              className="w-full"
              value={typeof value === 'string' ? value : definition.default}
              options={definition.options.map((option) => ({ ...option, label: t(option.label) }))}
              onChange={(next) => props.onChange(definition.id, next)}
            />
          )
        else if (definition.kind === 'asset') {
          const asset = (value ?? definition.default) as AssetReference
          control =
            props.block || definition.themeOptions?.length ? (
              <Select
                {...common}
                className="w-full"
                value={asset.kind === 'theme' ? asset.path : undefined}
                options={(
                  definition.themeOptions ?? [
                    { label: t('Default image'), value: definition.default },
                  ]
                ).map((option) => ({
                  label: t(option.label),
                  value: option.value.kind === 'theme' ? option.value.path : option.label,
                }))}
                onChange={(path) => {
                  const option = definition.themeOptions?.find(
                    (option) => option.value.path === path
                  )
                  if (option) props.onChange(definition.id, option.value)
                }}
              />
            ) : (
              <CatalogMediaPicker
                label={label}
                showLabel={false}
                disabled={props.disabled}
                value={asset}
                defaultValue={definition.default}
                onChange={(next) => props.onChange(definition.id, next)}
              />
            )
        } else if (definition.kind === 'navigation-reference') {
          const reference =
            typeof value === 'object' &&
            value !== null &&
            'kind' in value &&
            value.kind === 'navigation'
              ? value
              : undefined
          control = (
            <Select
              {...common}
              className="w-full"
              allowClear
              value={reference?.id}
              options={(props.menus ?? []).map((menu) => ({
                label: `${t(menu.placement === 'header' ? 'Header menu' : 'Footer menu')} · ${menu.id}`,
                value: menu.id,
              }))}
              onChange={(id?: string) => {
                if (id) props.onChange(definition.id, { kind: 'navigation', id })
                else props.onClear?.(definition.id)
              }}
            />
          )
        } else if (definition.kind === 'link') {
          const link = (value ?? definition.default) as StorefrontLink | undefined
          control = link ? (
            <StorefrontLinkEditor
              disabled={props.disabled}
              label={label}
              showLabel={false}
              value={link}
              resources={props.resources}
              allowedTargets={definition.allowedTargets}
              onChange={(next) => props.onChange(definition.id, next)}
            />
          ) : (
            <Button
              disabled={
                props.disabled ||
                (!definition.allowedTargets.includes('external') &&
                  !props.resources.some((resource) =>
                    definition.allowedTargets.includes(resource.kind)
                  ))
              }
              onClick={() => {
                const resource = props.resources.find((resource) =>
                  definition.allowedTargets.includes(resource.kind)
                )
                if (definition.allowedTargets.includes('external'))
                  props.onChange(definition.id, {
                    label: '',
                    target: { kind: 'external', url: '' },
                    targetBehavior: 'same-window',
                  })
                else if (resource)
                  props.onChange(definition.id, {
                    label: resource.label,
                    target: {
                      kind: 'internal',
                      reference: { id: resource.id, kind: resource.kind },
                    },
                    targetBehavior: 'same-window',
                  })
              }}
            >
              {t('Add link')}
            </Button>
          )
        } else {
          const kind = definition.kind.replace('-reference', '')
          const binding = props.bindings.find(
            (binding) =>
              binding.kind === 'catalog' &&
              binding.instanceId === props.instanceId &&
              binding.settingId === definition.id
          )
          const reference =
            binding?.kind === 'catalog'
              ? binding.reference
              : typeof value === 'object' && value !== null && 'id' in value
                ? value
                : undefined
          control = (
            <StorefrontResourcePicker
              label={label}
              showLabel={false}
              kind={kind as 'product' | 'collection' | 'page' | 'article' | 'policy'}
              disabled={props.disabled}
              releaseId={props.releaseId || undefined}
              missing={Boolean(
                reference?.id &&
                props.releaseId &&
                !props.resources.some(
                  (resource) => resource.id === reference.id && resource.kind === kind
                )
              )}
              value={reference?.id}
              onChange={(next) => {
                if (!next && props.block) props.onClear?.(definition.id)
                else if (props.block && next)
                  props.onChange(definition.id, {
                    id: next,
                    kind: kind as 'product' | 'collection' | 'page' | 'article' | 'policy',
                  })
                else if (kind === 'product' || kind === 'collection')
                  props.onReference(definition.id, kind, next)
                else if (next)
                  props.onChange(definition.id, {
                    id: next,
                    kind: kind as 'page' | 'article' | 'policy',
                  })
              }}
            />
          )
        }
        return (
          <Form.Item
            key={definition.id}
            label={label}
            htmlFor={id}
            tooltip={definition.helpText}
            required={definition.required}
            validateStatus={props.errors?.[definition.id] ? 'error' : undefined}
            help={
              props.errors?.[definition.id] ? (
                <span id={`${id}-error`}>{t('Enter a valid value for {label}.', { label })}</span>
              ) : undefined
            }
          >
            {control}
          </Form.Item>
        )
      })}
    </Form>
  )
}
