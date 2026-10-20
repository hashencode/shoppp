import type { ShippingMethodConfiguration, ShippingZoneConfiguration } from '@shoppp/contracts'
import {
  Button,
  Form,
  Input,
  InputNumber,
  Alert,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { useLocalizedApiError } from '../../shared/i18n/api-error'
import { fetchShippingZones, saveShippingZone } from '../../services/shipping/api'
import { useI18n } from '../../shared/contexts/i18n-context'
import { CustomPageRecipe } from '../../shared/template-kit/recipes/custom-page-recipe'

import { CrudFormDrawerRecipe } from '../../shared/template-kit/recipes/crud-form-drawer-recipe'
import { normalizeApiError } from '../../infrastructure/http/api-client'

void React

type EditableMethod = Omit<ShippingMethodConfiguration, 'id'> & { id?: string }
type ShippingFormValues = {
  countries: string[]
  id?: string
  methods: EditableMethod[]
  name: string
  reason: string
  status: 'active' | 'disabled'
}

const emptyMethod = (): EditableMethod => ({
  calculationType: 'flat',
  currency: 'USD',
  freeThresholdAmount: null,
  maxWeightGrams: null,
  minWeightGrams: null,
  name: '',
  priceAmount: 0,
  status: 'active',
})

const toRequest = (values: ShippingFormValues) => ({
  confirm: true as const,
  reason: values.reason ?? '',
  zone: {
    countries: (values.countries ?? []).map((country) => country.toUpperCase()),
    ...(values.id ? { id: values.id } : {}),
    methods: (values.methods ?? []).map((method) => ({
      ...method,
      currency: method.currency.toUpperCase(),
      freeThresholdAmount: method.freeThresholdAmount ?? null,
      maxWeightGrams: method.maxWeightGrams ?? null,
      minWeightGrams: method.minWeightGrams ?? null,
    })),
    name: values.name ?? '',
    status: values.status,
  },
})

export const ShippingSettingsPage = () => {
  const { role, permissions } = useAuth()
  const { t } = useI18n()
  const localizeError = useLocalizedApiError()
  const canWrite = hasPermission(role, 'settings.write', permissions)
  const [zones, setZones] = useState<ShippingZoneConfiguration[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editorValues, setEditorValues] = useState<ShippingFormValues | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [form] = Form.useForm<ShippingFormValues>()

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setZones(await fetchShippingZones())
    } catch (error) {
      setLoadError(localizeError(error))
    } finally {
      setLoading(false)
    }
  }, [localizeError])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const openEditor = useCallback(
    (zone?: ShippingZoneConfiguration) => {
      if (open) return
      const values: ShippingFormValues = zone
        ? {
            countries: zone.countries,
            id: zone.id,
            methods: zone.methods.map((method) => ({ ...method })),
            name: zone.name,
            reason: '',
            status: zone.status,
          }
        : {
            countries: [],
            id: undefined,
            methods: [emptyMethod()],
            name: '',
            reason: '',
            status: 'active',
          }
      form.resetFields()
      form.setFieldsValue(values)
      setEditorValues(values)
      setOpen(true)
    },
    [form, open]
  )

  const columns = useMemo(
    () => [
      { key: 'name', title: t('Zone'), dataIndex: 'name', width: 180 },
      {
        key: 'status',
        title: t('Status'),
        dataIndex: 'status',
        width: 100,
        render: (status: ShippingZoneConfiguration['status']) => (
          <Tag color={status === 'active' ? 'success' : 'default'}>{t(status)}</Tag>
        ),
      },
      {
        key: 'countries',
        title: t('Countries'),
        width: 220,
        render: (_: unknown, zone: ShippingZoneConfiguration) => (
          <Space size={[4, 4]} wrap>
            {zone.countries.map((country) => (
              <Tag key={country}>{country}</Tag>
            ))}
          </Space>
        ),
      },
      {
        key: 'methods',
        title: t('Methods'),
        render: (_: unknown, zone: ShippingZoneConfiguration) => (
          <Space orientation="vertical" size={2}>
            {zone.methods.map((method) => (
              <span key={method.id}>
                {method.name} · {method.calculationType} · {method.priceAmount} {method.currency}
                {method.status === 'disabled' ? ` · ${t('disabled')}` : ''}
              </span>
            ))}
          </Space>
        ),
      },
      {
        key: 'actions',
        title: t('Actions'),
        width: 100,
        render: (_: unknown, zone: ShippingZoneConfiguration) =>
          canWrite ? (
            <Button type="link" className="!px-0" disabled={open} onClick={() => openEditor(zone)}>
              {t('Edit')}
            </Button>
          ) : null,
      },
    ],
    [canWrite, open, openEditor, t]
  )

  return (
    <CustomPageRecipe
      title={t('Shipping settings')}
      extra={
        canWrite ? (
          <Button type="primary" disabled={open} onClick={() => openEditor()}>
            {t('New zone')}
          </Button>
        ) : null
      }
    >
      <Table<ShippingZoneConfiguration>
        rowKey="id"
        columns={columns}
        dataSource={zones}
        loading={loading}
        pagination={false}
        scroll={{ x: 900 }}
        locale={{ emptyText: t('No shipping zones configured.') }}
      />

      {loadError ? (
        <Alert
          type="error"
          showIcon
          title={t('List could not be loaded')}
          description={loadError}
          action={<Button onClick={() => void load()}>{t('Retry')}</Button>}
        />
      ) : null}
      {open && editorValues ? (
        <CrudFormDrawerRecipe<ShippingFormValues>
          spec={{
            title: t(editorValues.id ? 'Edit shipping zone' : 'New shipping zone'),
            successTitle: t('Shipping zone saved and audited.'),
            parsedMode: {
              ok: true,
              mode: editorValues.id ? 'modify' : 'add',
              resourceKey: editorValues.id,
            },
            permissionDenied: !canWrite,
            detailLoading: false,
            detailError: null,
            saveLoading: false,
            isReadonly: !canWrite,
            form,
            initialValues: editorValues,
            onRetryDetail: () => undefined,
            onResetAll: () => {
              form.resetFields()
              form.setFieldsValue(editorValues)
            },
            hasUnsavedChanges: () =>
              JSON.stringify(toRequest(form.getFieldsValue(true))) !==
              JSON.stringify(toRequest(editorValues)),
            onClose: () => {
              setOpen(false)
              setEditorValues(null)
            },
            onSaved: load,
            onSubmit: async (values) => {
              if (!canWrite)
                return {
                  success: false,
                  error: normalizeApiError(new Error('Shipping settings are read-only.')),
                }
              try {
                await saveShippingZone(toRequest(values))
                return { success: true }
              } catch (error) {
                return { success: false, error: normalizeApiError(error) }
              }
            },
            renderFields: () => (
              <>
                <Form.Item name="id" hidden>
                  <Input />
                </Form.Item>
                <div>
                  <Form.Item name="name" label={t('Zone name')} rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="status" label={t('Status')} rules={[{ required: true }]}>
                    <Select
                      className="w-full"
                      options={['active', 'disabled'].map((value) => ({ label: t(value), value }))}
                    />
                  </Form.Item>
                </div>
                <Form.Item
                  name="countries"
                  label={t('Country allowlist')}
                  rules={[
                    { required: true, message: t('Add at least one two-letter country code.') },
                  ]}
                >
                  <Select mode="tags" tokenSeparators={[',']} />
                </Form.Item>
                <Form.List name="methods">
                  {(fields, { add, remove }) => (
                    <Space orientation="vertical" className="w-full">
                      {fields.map((field, index) => (
                        <div
                          key={field.key}
                          className="grid gap-3 rounded border border-slate-200 p-3 grid-cols-2 min-w-0"
                        >
                          <Form.Item name={[field.name, 'id']} hidden>
                            <Input />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'name']}
                            className="col-span-2"
                            label={t('Method {number}', { number: index + 1 })}
                            rules={[{ required: true }]}
                          >
                            <Input />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'calculationType']}
                            label={t('Calculation')}
                            rules={[{ required: true }]}
                          >
                            <Select
                              options={['flat', 'weight'].map((value) => ({
                                label: t(value),
                                value,
                              }))}
                            />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'priceAmount']}
                            label={t('Price (minor units)')}
                            rules={[{ required: true }]}
                          >
                            <InputNumber min={0} precision={0} className="w-full" />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'currency']}
                            label={t('Currency')}
                            rules={[{ required: true, len: 3 }]}
                          >
                            <Input maxLength={3} />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'freeThresholdAmount']}
                            label={t('Free threshold')}
                          >
                            <InputNumber min={0} precision={0} className="w-full" />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'minWeightGrams']}
                            label={t('Minimum grams')}
                          >
                            <InputNumber min={0} precision={0} className="w-full" />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'maxWeightGrams']}
                            label={t('Maximum grams')}
                          >
                            <InputNumber min={0} precision={0} className="w-full" />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'status']}
                            label={t('Status')}
                            rules={[{ required: true }]}
                          >
                            <Select
                              options={['active', 'disabled'].map((value) => ({
                                label: t(value),
                                value,
                              }))}
                            />
                          </Form.Item>
                          {fields.length > 1 ? (
                            <Button
                              danger
                              className="col-span-2"
                              onClick={() => remove(field.name)}
                            >
                              {t('Remove method')}
                            </Button>
                          ) : null}
                        </div>
                      ))}
                      <Button onClick={() => add(emptyMethod())}>{t('Add shipping method')}</Button>
                    </Space>
                  )}
                </Form.List>
                <Form.Item
                  name="reason"
                  label={t('Change reason')}
                  className="mt-4"
                  rules={[{ required: true, min: 3, max: 500 }]}
                >
                  <Input.TextArea rows={3} maxLength={500} />
                </Form.Item>
                <Typography.Paragraph type="secondary" className="mb-0">
                  {t(
                    'Saving updates shipping options and rates for new checkout requests in the current environment.'
                  )}
                </Typography.Paragraph>
              </>
            ),
          }}
        />
      ) : null}
    </CustomPageRecipe>
  )
}
