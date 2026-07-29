import type { ShippingMethodConfiguration, ShippingZoneConfiguration } from '@shoppp/contracts'
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError } from '../../infrastructure/http/api-client'
import { fetchShippingZones, saveShippingZone } from '../../services/shipping/api'

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
  const { role, permissions } = useAuth()
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
      void message.error(normalizeApiError(error).message)
    } finally {
      setLoading(false)
    }
  }, [])

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
      { key: 'name', title: 'Zone', dataIndex: 'name', width: 180 },
      {
        key: 'status',
        title: 'Status',
        dataIndex: 'status',
        width: 100,
        render: (status: ShippingZoneConfiguration['status']) => (
          <Tag color={status === 'active' ? 'success' : 'default'}>{status}</Tag>
        ),
      },
      {
        key: 'countries',
        title: 'Countries',
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
        title: 'Methods',
        render: (_: unknown, zone: ShippingZoneConfiguration) => (
          <Space orientation="vertical" size={2}>
            {zone.methods.map((method) => (
              <span key={method.id}>
                {method.name} · {method.calculationType} · {method.priceAmount}{' '}
                {method.currency}
                {method.status === 'disabled' ? ' · disabled' : ''}
              </span>
            ))}
          </Space>
        ),
      },
      {
        key: 'actions',
        title: 'Actions',
        width: 100,
        render: (_: unknown, zone: ShippingZoneConfiguration) =>
          canWrite ? (
            <Button type="link" className="!px-0" onClick={() => openEditor(zone)}>
              Edit
            </Button>
          ) : null,
      },
    ],
    [canWrite, openEditor]
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Shipping settings</h1>
          <p className="text-slate-500">
            Country zones, flat or weight-based rates, thresholds, and eligibility.
          </p>
        </div>
        {canWrite ? (
          <Button type="primary" onClick={() => openEditor()}>
            New zone
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
        locale={{ emptyText: 'No shipping zones configured.' }}
      />

      <Modal
        title={form.getFieldValue('id') ? 'Edit shipping zone' : 'New shipping zone'}
        open={open}
        width={900}
        okText="Confirm and save"
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
              void message.success('Shipping zone saved and audited.')
              setOpen(false)
              await load()
            } catch (error) {
              void message.error(normalizeApiError(error).message)
            } finally {
              setSaving(false)
            }
          }}
        >
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <Space align="start" wrap>
            <Form.Item name="name" label="Zone name" rules={[{ required: true }]}>
              <Input className="w-64" />
            </Form.Item>
            <Form.Item name="status" label="Status" rules={[{ required: true }]}>
              <Select
                className="w-40"
                options={[{ value: 'active' }, { value: 'disabled' }]}
              />
            </Form.Item>
          </Space>
          <Form.Item
            name="countries"
            label="Country allowlist"
            rules={[{ required: true, message: 'Add at least one two-letter country code.' }]}
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
                      label={`Method ${index + 1}`}
                      rules={[{ required: true }]}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'calculationType']}
                      label="Calculation"
                      rules={[{ required: true }]}
                    >
                      <Select options={[{ value: 'flat' }, { value: 'weight' }]} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'priceAmount']}
                      label="Price (minor units)"
                      rules={[{ required: true }]}
                    >
                      <InputNumber min={0} precision={0} className="w-full" />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'currency']}
                      label="Currency"
                      rules={[{ required: true, len: 3 }]}
                    >
                      <Input maxLength={3} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'freeThresholdAmount']}
                      label="Free threshold"
                    >
                      <InputNumber min={0} precision={0} className="w-full" />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'minWeightGrams']}
                      label="Minimum grams"
                    >
                      <InputNumber min={0} precision={0} className="w-full" />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'maxWeightGrams']}
                      label="Maximum grams"
                    >
                      <InputNumber min={0} precision={0} className="w-full" />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'status']}
                      label="Status"
                      rules={[{ required: true }]}
                    >
                      <Select options={[{ value: 'active' }, { value: 'disabled' }]} />
                    </Form.Item>
                    {fields.length > 1 ? (
                      <Button danger onClick={() => remove(field.name)}>
                        Remove method
                      </Button>
                    ) : null}
                  </div>
                ))}
                <Button onClick={() => add(emptyMethod())}>Add shipping method</Button>
              </Space>
            )}
          </Form.List>
          <Form.Item
            name="reason"
            label="Change reason"
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
