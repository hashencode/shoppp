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
import { useLocalizedApiError } from '../../shared/i18n/api-error'
import {
  fetchLaunchConfiguration,
  fetchOperationalHealth,
  updateLaunchConfiguration,
} from '../../services/platform/api'
import { useCurrentTranslate, useI18n } from '../../shared/contexts/i18n-context'

void React

type FormValues = LaunchConfiguration & { reason: string }
type LaunchIssueCode = LaunchConfigurationStatus['issues'][number]['code']
type HealthFailureKey = keyof OperationalHealth['failures']

const ENVIRONMENT_LABEL: Record<LaunchConfigurationStatus['environment'], string> = {
  development: 'Development',
  staging: 'Staging',
  production: 'Production',
}
const HEALTH_STATUS_LABEL: Record<OperationalHealth['status'], string> = {
  ok: 'Healthy',
  degraded: 'Degraded',
}
const HEALTH_FAILURE_LABEL: Record<HealthFailureKey, string> = {
  catalogBuilds: 'Catalog build failures',
  deadLetterJobs: 'Dead-letter jobs',
  paymentEvents: 'Payment event failures',
  reportExports: 'Report export failures',
}
const LAUNCH_ISSUE_MESSAGE: Record<LaunchIssueCode, string> = {
  legal_approval_missing: 'Legal approval for the published policies is required.',
  payment_provider_missing: 'The payment provider credential is not configured.',
  payment_webhook_missing: 'The payment webhook credential is not configured.',
  production_payment_mode_not_live: 'Production must use the live payment provider mode.',
  placeholder_policy_url: 'Production policy links cannot use placeholder domains.',
  sellable_currency_unavailable: 'Every sellable currency must have an active price list.',
  shipping_country_unavailable: 'Every enabled country must belong to an active shipping zone.',
  shipping_method_unavailable:
    'Every enabled shipping method must exist in an active shipping zone.',
  oversell_policy_mismatch:
    'Inventory oversell limits must be zero when the launch policy denies oversell.',
  reservation_ttl_mismatch:
    'The launch reservation duration must match the Worker runtime value.',
  turnstile_site_key_missing:
    'Turnstile is required but its environment-specific public site key is missing.',
  turnstile_secret_missing:
    'Turnstile is required but its server-side secret is not configured.',
  backup_export_missing:
    'The scheduled D1 export credential or target binding is not configured.',
}

export const LaunchSettingsPage = () => {
  const { t } = useI18n()
  const translateNow = useCurrentTranslate()
  const localizeError = useLocalizedApiError()
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
      void message.error(localizeError(error))
    } finally {
      setLoading(false)
    }
  }, [form, localizeError])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('Launch settings')}</h1>
        <p className="text-slate-500">
          {t('Validated commercial configuration and server-confirmed production gates.')}
        </p>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={t('Launch readiness')} loading={loading}>
            <Space wrap>
              <Tag color={status?.ready ? 'success' : 'error'}>
                {t(status?.ready ? 'Ready' : 'Blocked')}
              </Tag>
              <span>{status?.environment ? t(ENVIRONMENT_LABEL[status.environment]) : null}</span>
            </Space>
            {status?.issues.map((issue) => (
              <Alert
                key={issue.code}
                className="mt-3"
                type="warning"
                message={t(LAUNCH_ISSUE_MESSAGE[issue.code])}
                showIcon
              />
            ))}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={t('Checkout-impacting health')} loading={loading}>
            <Space wrap>
              <Tag color={health?.status === 'ok' ? 'success' : 'error'}>
                {health?.status ? t(HEALTH_STATUS_LABEL[health.status]) : null}
              </Tag>
              {health
                ? Object.entries(health.failures).map(([key, value]) => (
                    <span key={key}>
                      {t(HEALTH_FAILURE_LABEL[key as HealthFailureKey])}: <strong>{value}</strong>
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
              void message.success(translateNow('Launch configuration saved and audited.'))
            } catch (error) {
              void message.error(localizeError(error))
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
                label={t('Default currency')}
                rules={[{ required: true }]}
              >
                <Input maxLength={3} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="orderNumberPrefix"
                label={t('Order prefix')}
                rules={[{ required: true }]}
              >
                <Input maxLength={12} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="reservationTtlMinutes"
                label={t('Reservation TTL (minutes)')}
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
                label={t('Sellable currencies')}
                rules={[{ required: true }]}
              >
                <Select mode="tags" tokenSeparators={[',']} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="shippingCountries"
                label={t('Shipping countries')}
                rules={[{ required: true }]}
              >
                <Select mode="tags" tokenSeparators={[',']} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="shippingMethodIds"
            label={t('Enabled shipping method IDs')}
            rules={[{ required: true }]}
          >
            <Select mode="tags" tokenSeparators={[',']} />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="oversellPolicy" label={t('Oversell policy')}>
                <Select
                  options={['deny', 'limited'].map((value) => ({ label: t(value), value }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="paymentMode" label={t('Payment mode')}>
                <Select options={['test', 'live'].map((value) => ({ label: t(value), value }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="taxMode" label={t('Tax mode')}>
                <Select disabled options={[{ label: t('zero'), value: 'zero' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="supportEmail"
                label={t('Support email')}
                rules={[{ required: true, type: 'email' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="privacyContactEmail"
                label={t('Privacy contact email')}
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
                label={t('{policy} policy URL', { policy: t(policy) })}
                rules={[{ required: true, type: 'url' }]}
              >
                <Input />
              </Form.Item>
            )
          )}
          <Space wrap className="mb-4">
            <Form.Item name="legalApproved" label={t('Legal approval')} valuePropName="checked">
              <Switch />
            </Form.Item>
            <span>
              {t('Provider credential')}:{' '}
              <Tag>{t(status?.configuration.providerConfigured ? 'configured' : 'missing')}</Tag>
            </span>
            <span>
              {t('Webhook credential')}:{' '}
              <Tag>{t(status?.configuration.webhookConfigured ? 'configured' : 'missing')}</Tag>
            </span>
          </Space>
          <Form.Item
            name="reason"
            label={t('Change reason')}
            rules={[{ required: true, min: 3, max: 500 }]}
          >
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>
            {t('Confirm and save')}
          </Button>
        </Form>
      </Card>
    </div>
  )
}
