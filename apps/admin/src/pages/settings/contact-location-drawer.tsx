import type { ContactProfile } from '@shoppp/contracts'
import { Alert, Button, Descriptions, Form, Input, Space, Switch, Typography } from 'antd'
import React, { useEffect, useState } from 'react'
import { SortActionGroup } from '../../shared/components/sort-action-group'
import { useI18n } from '../../shared/contexts/i18n-context'
import { CrudFormDrawerRecipe } from '../../shared/template-kit/recipes/crud-form-drawer-recipe'

type Location = ContactProfile['locations'][number]
void React
type Props = {
  value?: Location[]
  onChange?: (locations: Location[]) => void
  readOnly: boolean
  busy: boolean
  onEditingChange: (editing: boolean) => void
}

const emptyLocation = (): Location => ({
  id: crypto.randomUUID(),
  name: '',
  city: '',
  address: '',
  phone: null,
  email: null,
  mapUrl: null,
  visible: false,
})
const normalize = (location: Location): Location => ({
  ...location,
  phone: location.phone?.trim() || null,
  email: location.email?.trim() || null,
  mapUrl: location.mapUrl?.trim() || null,
})

const LocationDrawer = ({
  initial,
  isNew,
  readOnly,
  busy,
  onApply,
  onClose,
}: {
  initial: Location
  isNew: boolean
  readOnly: boolean
  busy: boolean
  onApply: (location: Location) => void
  onClose: () => void
}) => {
  const { t } = useI18n()
  const [form] = Form.useForm<Location>()
  return (
    <CrudFormDrawerRecipe<Location>
      spec={{
        title: t(isNew ? 'New location' : readOnly ? 'View location' : 'Edit location'),
        successTitle: t(
          isNew ? 'Location added to unsaved changes' : 'Location updated in unsaved changes'
        ),
        parsedMode: {
          ok: true,
          mode: readOnly ? 'readonly' : isNew ? 'add' : 'modify',
          resourceKey: initial.id,
        },
        permissionDenied: false,
        detailLoading: false,
        detailError: null,
        saveLoading: false,
        actionBusy: busy,
        isReadonly: readOnly,
        form,
        initialValues: initial,
        onRetryDetail: () => undefined,
        onResetAll: () => {
          form.resetFields()
          form.setFieldsValue(initial)
        },
        hasUnsavedChanges: () =>
          JSON.stringify(normalize(form.getFieldsValue(true))) !==
          JSON.stringify(normalize(initial)),
        onClose,
        onSaved: async () => undefined,
        onSubmit: async (values) => {
          if (readOnly || busy) return { cancelled: true }
          onApply(normalize(values))
          return { success: true }
        },
        renderFields: () => (
          <>
            {!readOnly ? (
              <Alert
                type="info"
                showIcon
                className="mb-4"
                title={t(
                  'Changes are applied to the contact settings draft. Save the page to persist them.'
                )}
              />
            ) : null}
            <Form.Item name="id" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="name" label={t('Location name')} rules={[{ required: true }]}>
              <Input maxLength={120} />
            </Form.Item>
            <Form.Item name="city" label={t('City')} rules={[{ required: true }]}>
              <Input maxLength={120} />
            </Form.Item>
            <Form.Item name="address" label={t('Postal address')} rules={[{ required: true }]}>
              <Input maxLength={500} />
            </Form.Item>
            <Form.Item
              name="phone"
              label={t('Location phone')}
              rules={[
                {
                  pattern: /^\+[1-9]\d{1,14}$/,
                  message: t('Use an international phone number, such as +12025550123.'),
                },
              ]}
            >
              <Input type="tel" />
            </Form.Item>
            <Form.Item name="email" label={t('Location email')} rules={[{ type: 'email' }]}>
              <Input type="email" />
            </Form.Item>
            <Form.Item
              name="mapUrl"
              label={t('Verified map URL')}
              rules={[
                {
                  validator: async (_, value: string | null | undefined) => {
                    if (!value) return
                    try {
                      const url = new URL(value)
                      if (url.protocol === 'https:' && !url.username && !url.password) return
                    } catch {
                      /* Show the field error below. */
                    }
                    throw new Error(t('Enter an HTTPS URL.'))
                  },
                },
              ]}
            >
              <Input type="url" />
            </Form.Item>
            <Form.Item name="visible" label={t('Publish location')} valuePropName="checked">
              <Switch />
            </Form.Item>
          </>
        ),
      }}
    />
  )
}

export const ContactLocationsField = ({
  value = [],
  onChange,
  readOnly,
  busy,
  onEditingChange,
}: Props) => {
  const { t } = useI18n()
  const [editor, setEditor] = useState<{ index: number | null; initial: Location } | null>(null)
  useEffect(() => {
    onEditingChange(editor !== null)
  }, [editor, onEditingChange])
  const move = (index: number, offset: -1 | 1) => {
    if (readOnly || busy || editor) return
    const next = [...value]
    const target = index + offset
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    onChange?.(next)
  }
  return (
    <div className="space-y-4">
      {value.map((location, index) => (
        <div
          key={location.id}
          className="space-y-2 rounded-lg border border-solid border-[var(--ant-color-border-secondary)] p-4"
        >
          <Typography.Text strong>
            {location.name || t('Location {number}', { number: index + 1 })}
          </Typography.Text>
          <Descriptions
            size="small"
            column={1}
            styles={{ content: { overflowWrap: 'anywhere' } }}
            items={[
              { key: 'city', label: t('City'), children: location.city },
              { key: 'address', label: t('Postal address'), children: location.address },
              {
                key: 'visibility',
                label: t('Status'),
                children: t(location.visible ? 'Published' : 'Not public'),
              },
            ]}
          />
          <div>
            <Space wrap>
              <Button
                disabled={busy || editor !== null}
                onClick={() => setEditor({ index, initial: structuredClone(location) })}
              >
                {t(readOnly ? 'View location' : 'Edit location')}
              </Button>
              {!readOnly ? (
                <SortActionGroup
                  index={index}
                  count={value.length}
                  disabled={busy || editor !== null}
                  moveUpLabel={t('Move up')}
                  moveDownLabel={t('Move down')}
                  removeLabel={t('Remove location')}
                  onMoveUp={() => move(index, -1)}
                  onMoveDown={() => move(index, 1)}
                  onRemove={() => onChange?.(value.filter((item) => item.id !== location.id))}
                />
              ) : null}
            </Space>
          </div>
        </div>
      ))}
      {!readOnly ? (
        <Button
          disabled={busy || editor !== null}
          onClick={() => setEditor({ index: null, initial: emptyLocation() })}
        >
          {t('Add location')}
        </Button>
      ) : null}
      {editor ? (
        <LocationDrawer
          initial={editor.initial}
          isNew={editor.index === null}
          readOnly={readOnly}
          busy={busy}
          onClose={() => setEditor(null)}
          onApply={(location) => {
            if (readOnly || busy) return
            onChange?.(
              editor.index === null
                ? [...value, location]
                : value.map((item) => (item.id === editor.initial.id ? location : item))
            )
          }}
        />
      ) : null}
    </div>
  )
}
