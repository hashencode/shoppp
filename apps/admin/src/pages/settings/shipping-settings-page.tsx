import type { ShippingMethodConfiguration, ShippingZoneConfiguration } from '@shoppp/contracts'
import { Button, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, App } from 'antd'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { useLocalizedApiError } from '../../shared/i18n/api-error'
import { fetchShippingZones, saveShippingZone } from '../../services/shipping/api'
import { useCurrentTranslate, useI18n } from '../../shared/contexts/i18n-context'

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

export const ShippingSettingsPage = () => {
  const { message } = App.useApp()
  const { role, permissions } = useAuth()
  const { t } = useI18n()
  const translateNow = useCurrentTranslate()
  const localizeError = useLocalizedApiError()
  const canWrite = hasPermission(role, 'settings.write', permissions)
  const [zones, setZones] = useState<ShippingZoneConfiguration[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<ShippingFormValues>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setZones(await fetchShippingZones())
    } catch (error) {
      void message.error(localizeError(error))
    } finally {
      setLoading(false)
    }
  }, [message, localizeError])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const openEditor = useCallback(
    (zone?: ShippingZoneConfiguration) => {
      form.setFieldsValue(
        zone
          ? {
              countries: zone.countries,
              id: zone.id,
              methods: zone.methods,
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
      )
      setOpen(true)
    },
    [form]
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
            <Button type="link" className="!px-0" onClick={() => openEditor(zone)}>
              {t('Edit')}
            </Button>
          ) : null,
      },
    ],
    [canWrite, openEditor, t]
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('Shipping settings')}</h1>
          <p className="text-slate-500">
            {t('Country zones, flat or weight-based rates, thresholds, and eligibility.')}
          </p>
        </div>
        {canWrite ? (
          <Button type="primary" onClick={() => openEditor()}>
            {t('New zone')}
          </Button>
        ) : null}
      </div>
      <Table<ShippingZoneConfiguration>
        rowKey="id"
        columns={columns}
        dataSource={zones}
        loading={loading}
        pagination={false}
        scroll={{ x: 900 }}
        locale={{ emptyText: t('No shipping zones configured.') }}
      />

      <Modal
        title={t(form.getFieldValue('id') ? 'Edit shipping zone' : 'New shipping zone')}
        open={open}
        width={900}
        okText={t('Confirm and save')}
        confirmLoading={saving}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
      >
        <Form<ShippingFormValues>
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            setSaving(true)
            try {
              await saveShippingZone({
                confirm: true,
                reason: values.reason,
                zone: {
                  countries: values.countries.map((country) => country.toUpperCase()),
                  ...(values.id ? { id: values.id } : {}),
                  methods: values.methods.map((method) => ({
                    ...method,
                    currency: method.currency.toUpperCase(),
                    freeThresholdAmount: method.freeThresholdAmount ?? null,
                    maxWeightGrams: method.maxWeightGrams ?? null,
                    minWeightGrams: method.minWeightGrams ?? null,
                  })),
                  name: values.name,
                  status: values.status,
                },
              })
              void message.success(translateNow('Shipping zone saved and audited.'))
              setOpen(false)
              await load()
            } catch (error) {
              void message.error(localizeError(error))
            } finally {
              setSaving(false)
            }
          }}
        >
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <Space align="start" wrap>
            <Form.Item name="name" label={t('Zone name')} rules={[{ required: true }]}>
              <Input className="w-64" />
            </Form.Item>
            <Form.Item name="status" label={t('Status')} rules={[{ required: true }]}>
              <Select
                className="w-40"
                options={['active', 'disabled'].map((value) => ({ label: t(value), value }))}
              />
            </Form.Item>
          </Space>
          <Form.Item
            name="countries"
            label={t('Country allowlist')}
            rules={[{ required: true, message: t('Add at least one two-letter country code.') }]}
          >
            <Select mode="tags" tokenSeparators={[',']} />
          </Form.Item>
          <Form.List name="methods">
            {(fields, { add, remove }) => (
              <Space orientation="vertical" className="w-full">
                {fields.map((field, index) => (
                  <div
                    key={field.key}
                    className="grid gap-3 rounded border border-slate-200 p-3 md:grid-cols-4"
                  >
                    <Form.Item name={[field.name, 'id']} hidden>
                      <Input />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'name']}
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
                        options={['flat', 'weight'].map((value) => ({ label: t(value), value }))}
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
                    <Form.Item name={[field.name, 'minWeightGrams']} label={t('Minimum grams')}>
                      <InputNumber min={0} precision={0} className="w-full" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'maxWeightGrams']} label={t('Maximum grams')}>
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
                      <Button danger onClick={() => remove(field.name)}>
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
        </Form>
      </Modal>
    </div>
  )
}
