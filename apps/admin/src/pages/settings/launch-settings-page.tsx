import type {
  LaunchConfiguration,
  LaunchConfigurationStatus,
  OperationalHealth,
} from '@shoppp/contracts'
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  message,
} from 'antd'
import React, { useCallback, useEffect, useState } from 'react'
import { normalizeApiError } from '../../infrastructure/http/api-client'
import {
  fetchLaunchConfiguration,
  fetchOperationalHealth,
  updateLaunchConfiguration,
} from '../../services/platform/api'

void React

type FormValues = LaunchConfiguration & { reason: string }

export const LaunchSettingsPage = () => {
  const [form] = Form.useForm<FormValues>()
  const [status, setStatus] = useState<LaunchConfigurationStatus | null>(null)
  const [health, setHealth] = useState<OperationalHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [configuration, operationalHealth] = await Promise.all([
        fetchLaunchConfiguration(),
        fetchOperationalHealth(),
      ])
      setStatus(configuration)
      setHealth(operationalHealth)
      form.setFieldsValue({ ...configuration.configuration, reason: '' })
    } catch (error) {
      void message.error(normalizeApiError(error).message)
    } finally {
      setLoading(false)
    }
  }, [form])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Launch settings</h1>
        <p className="text-slate-500">
          Validated commercial configuration and server-confirmed production gates.
        </p>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Launch readiness" loading={loading}>
            <Space wrap>
              <Tag color={status?.ready ? 'success' : 'error'}>
                {status?.ready ? 'Ready' : 'Blocked'}
              </Tag>
              <span>{status?.environment}</span>
            </Space>
            {status?.issues.map((issue) => (
              <Alert
                key={issue.code}
                className="mt-3"
                type="warning"
                message={issue.message}
                showIcon
              />
            ))}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Checkout-impacting health" loading={loading}>
            <Space wrap>
              <Tag color={health?.status === 'ok' ? 'success' : 'error'}>{health?.status}</Tag>
              {health
                ? Object.entries(health.failures).map(([key, value]) => (
                    <span key={key}>
                      {key}: <strong>{value}</strong>
                    </span>
                  ))
                : null}
            </Space>
          </Card>
        </Col>
      </Row>
      <Card loading={loading}>
        <Form<FormValues>
          form={form}
          layout="vertical"
          onFinish={async ({ reason, ...configuration }) => {
            setSubmitting(true)
            try {
              const updated = await updateLaunchConfiguration(configuration, reason)
              setStatus(updated)
              form.setFieldValue('reason', '')
              void message.success('Launch configuration saved and audited.')
            } catch (error) {
              void message.error(normalizeApiError(error).message)
            } finally {
              setSubmitting(false)
            }
          }}
        >
          <Form.Item name="paymentProvider" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="providerConfigured" hidden valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="webhookConfigured" hidden valuePropName="checked">
            <Switch />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="defaultCurrency"
                label="Default currency"
                rules={[{ required: true }]}
              >
                <Input maxLength={3} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="orderNumberPrefix" label="Order prefix" rules={[{ required: true }]}>
                <Input maxLength={12} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="reservationTtlMinutes"
                label="Reservation TTL (minutes)"
                rules={[{ required: true }]}
              >
                <InputNumber min={5} max={120} className="w-full" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="sellableCurrencies"
                label="Sellable currencies"
                rules={[{ required: true }]}
              >
                <Select mode="tags" tokenSeparators={[',']} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="shippingCountries"
                label="Shipping countries"
                rules={[{ required: true }]}
              >
                <Select mode="tags" tokenSeparators={[',']} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="shippingMethodIds"
            label="Enabled shipping method IDs"
            rules={[{ required: true }]}
          >
            <Select mode="tags" tokenSeparators={[',']} />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="oversellPolicy" label="Oversell policy">
                <Select options={[{ value: 'deny' }, { value: 'limited' }]} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="paymentMode" label="Payment mode">
                <Select options={[{ value: 'test' }, { value: 'live' }]} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="taxMode" label="Tax mode">
                <Select disabled options={[{ value: 'zero' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="supportEmail"
                label="Support email"
                rules={[{ required: true, type: 'email' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="privacyContactEmail"
                label="Privacy contact email"
                rules={[{ required: true, type: 'email' }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          {(['privacy', 'terms', 'shipping', 'returns', 'contact', 'cookies'] as const).map(
            (policy) => (
              <Form.Item
                key={policy}
                name={['policies', policy]}
                label={`${policy[0].toUpperCase()}${policy.slice(1)} policy URL`}
                rules={[{ required: true, type: 'url' }]}
              >
                <Input />
              </Form.Item>
            )
          )}
          <Space wrap className="mb-4">
            <Form.Item name="legalApproved" label="Legal approval" valuePropName="checked">
              <Switch />
            </Form.Item>
            <span>
              Provider credential:{' '}
              <Tag>{status?.configuration.providerConfigured ? 'configured' : 'missing'}</Tag>
            </span>
            <span>
              Webhook credential:{' '}
              <Tag>{status?.configuration.webhookConfigured ? 'configured' : 'missing'}</Tag>
            </span>
          </Space>
          <Form.Item
            name="reason"
            label="Change reason"
            rules={[{ required: true, min: 3, max: 500 }]}
          >
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>
            Confirm and save
          </Button>
        </Form>
      </Card>
    </div>
  )
}
