import type {
  LaunchConfiguration,
  LaunchConfigurationStatus,
  OperationalHealth,
} from '@shoppp/contracts'
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Tag,
  App,
} from 'antd'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError, type ApiError } from '../../infrastructure/http/api-client'
import { getFormModeViewModel } from '../../routes/form-route-contract'
import {
  fetchLaunchConfiguration,
  fetchOperationalHealth,
  updateLaunchConfiguration,
} from '../../services/platform/api'
import { useCurrentTranslate, useI18n } from '../../shared/contexts/i18n-context'
import { useLocalizedApiError } from '../../shared/i18n/api-error'
import { BasicCrudFormRecipe } from '../../shared/template-kit/form'
import { FORM_CARD_BODY_WIDTH_CLASS_NAME } from '../../shared/template-kit/form/form-content-width'

void React

type FormValues = LaunchConfiguration & { reason: string }
const HEALTH_FAILURE_LABEL: Record<keyof OperationalHealth['failures'], string> = {
  catalogBuilds: 'Catalog build failures',
  deadLetterJobs: 'Dead-letter jobs',
  paymentEvents: 'Payment event failures',
  reportExports: 'Report export failures',
}
const ENVIRONMENT_LABEL: Record<LaunchConfigurationStatus['environment'], string> = {
  development: 'Development',
  staging: 'Staging',
  production: 'Production',
}
const SECTION_IDS = ['contacts', 'sales', 'payment', 'policies']

export const LaunchSettingsPage = () => {
  const { message } = App.useApp()
  const { t } = useI18n()
  const translateNow = useCurrentTranslate()
  const localizeError = useLocalizedApiError()
  const { role, permissions } = useAuth()
  const canRead = hasPermission(role, 'settings.read', permissions)
  const canWrite = hasPermission(role, 'settings.write', permissions)
  const location = useLocation()
  const navigate = useNavigate()
  const [form] = Form.useForm<FormValues>()
  const [status, setStatus] = useState<LaunchConfigurationStatus | null>(null)
  const [health, setHealth] = useState<OperationalHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [healthLoading, setHealthLoading] = useState(true)
  const [configurationError, setConfigurationError] = useState<ApiError | null>(null)
  const [healthError, setHealthError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const configurationRequest = useRef(0)
  const healthRequest = useRef(0)

  const loadConfiguration = useCallback(async () => {
    const request = ++configurationRequest.current
    setLoading(true)
    setConfigurationError(null)
    setStatus(null)
    try {
      const configuration = await fetchLaunchConfiguration()
      if (request !== configurationRequest.current) return
      setStatus(configuration)
      form.setFieldsValue({ ...configuration.configuration, reason: '' })
    } catch (error) {
      if (request === configurationRequest.current) setConfigurationError(normalizeApiError(error))
    } finally {
      if (request === configurationRequest.current) setLoading(false)
    }
  }, [form])
  const loadHealth = useCallback(async () => {
    const request = ++healthRequest.current
    setHealthLoading(true)
    setHealthError(null)
    setHealth(null)
    try {
      const result = await fetchOperationalHealth()
      if (request === healthRequest.current) setHealth(result)
    } catch (error) {
      if (request === healthRequest.current) setHealthError(normalizeApiError(error))
    } finally {
      if (request === healthRequest.current) setHealthLoading(false)
    }
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (canRead) {
        void loadConfiguration()
        void loadHealth()
      }
    }, 0)
    return () => {
      window.clearTimeout(timer)
      configurationRequest.current += 1
      healthRequest.current += 1
    }
  }, [canRead, loadConfiguration, loadHealth])
  useEffect(() => {
    if (loading || !status) return
    const id = location.hash.slice(1)
    if (SECTION_IDS.includes(id)) document.getElementById(id)?.scrollIntoView?.({ block: 'start' })
  }, [loading, status, location.hash])

  const mode = canWrite ? 'modify' : 'readonly'
  return (
    <div className="space-y-4">
      {canRead && status ? <Tag>{t(ENVIRONMENT_LABEL[status.environment])}</Tag> : null}
      {canRead && new URLSearchParams(location.search).get('from') !== 'setup-guide' ? (
        <Link className="underline underline-offset-4" to="/welcome">
          {t('View store setup checks')}
        </Link>
      ) : null}
      <BasicCrudFormRecipe<FormValues>
        spec={{
          parsedMode: { ok: true, mode, resourceKey: 'commercial-configuration' },
          modeView: getFormModeViewModel(mode),
          permissionDenied: !canRead,
          detailLoading: loading,
          detailError: configurationError,
          saveLoading: submitting,
          isReadonly: !canWrite,
          form,
          initialValues: {},
          title: t('Commercial settings'),
          stateCopy: { submitSuccessMessage: t('Launch configuration saved and audited.') },
          onBackToList: () => navigate('/'),
          onRetryDetail: () => void loadConfiguration(),
          onResetAll: () => {
            if (canWrite && status) form.setFieldsValue({ ...status.configuration, reason: '' })
          },
          onSubmit: async ({ reason, ...configuration }) => {
            if (!canRead || !canWrite || submitting || !status) return
            setSubmitting(true)
            try {
              const updated = await updateLaunchConfiguration(configuration, reason)
              setStatus(updated)
              form.setFieldsValue({ ...updated.configuration, reason: '' })
              void message.success(translateNow('Launch configuration saved and audited.'))
            } catch (error) {
              void message.error(localizeError(error))
            } finally {
              setSubmitting(false)
            }
          },
          sections: [
            {
              key: 'contacts',
              title: <span id="contacts">{t('Contacts')}</span>,
              renderFields: () => (
                <>
                  <Form.Item
                    name="supportEmail"
                    label={t('Support email')}
                    rules={[{ required: true, type: 'email' }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name="privacyContactEmail"
                    label={t('Privacy contact email')}
                    rules={[{ required: true, type: 'email' }]}
                  >
                    <Input />
                  </Form.Item>
                </>
              ),
            },
            {
              key: 'sales',
              title: <span id="sales">{t('Sales and inventory')}</span>,
              renderFields: () => (
                <>
                  <Form.Item
                    name="defaultCurrency"
                    label={t('Default currency')}
                    rules={[{ required: true }]}
                  >
                    <Input maxLength={3} />
                  </Form.Item>
                  <Form.Item
                    name="orderNumberPrefix"
                    label={t('Order prefix')}
                    rules={[{ required: true }]}
                  >
                    <Input maxLength={12} />
                  </Form.Item>
                  <Form.Item
                    name="sellableCurrencies"
                    label={t('Sellable currencies')}
                    rules={[{ required: true }]}
                  >
                    <Select mode="tags" tokenSeparators={[',']} />
                  </Form.Item>
                  <Form.Item
                    name="shippingCountries"
                    label={t('Shipping countries')}
                    rules={[{ required: true }]}
                  >
                    <Select mode="tags" tokenSeparators={[',']} />
                  </Form.Item>
                  <Form.Item
                    name="shippingMethodIds"
                    label={t('Enabled shipping method IDs')}
                    rules={[{ required: true }]}
                  >
                    <Select mode="tags" tokenSeparators={[',']} />
                  </Form.Item>
                  <Form.Item name="oversellPolicy" label={t('Oversell policy')}>
                    <Select
                      options={['deny', 'limited'].map((value) => ({ label: t(value), value }))}
                    />
                  </Form.Item>
                  <Form.Item
                    name="reservationTtlMinutes"
                    label={t('Reservation TTL (minutes)')}
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={5} max={120} className="w-full" />
                  </Form.Item>
                  <Form.Item name="taxMode" label={t('Tax mode')}>
                    <Select disabled options={[{ label: t('zero'), value: 'zero' }]} />
                  </Form.Item>
                </>
              ),
            },
            {
              key: 'payment',
              title: <span id="payment">{t('Payments')}</span>,
              renderFields: () => (
                <>
                  <Form.Item name="paymentProvider" hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item name="providerConfigured" hidden valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name="webhookConfigured" hidden valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name="paymentMode" label={t('Payment mode')}>
                    <Select
                      options={['test', 'live'].map((value) => ({ label: t(value), value }))}
                    />
                  </Form.Item>
                  <Space wrap>
                    <span>
                      {t('Provider credential')}:{' '}
                      <Tag>
                        {t(status?.configuration.providerConfigured ? 'configured' : 'missing')}
                      </Tag>
                    </span>
                    <span>
                      {t('Webhook credential')}:{' '}
                      <Tag>
                        {t(status?.configuration.webhookConfigured ? 'configured' : 'missing')}
                      </Tag>
                    </span>
                  </Space>
                </>
              ),
            },
            {
              key: 'policies',
              title: <span id="policies">{t('Policies')}</span>,
              renderFields: () => (
                <>
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
                  <Form.Item
                    name="legalApproved"
                    label={t('Legal approval')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </>
              ),
            },
          ],
          renderAfterForm: (
            <Card classNames={{ body: FORM_CARD_BODY_WIDTH_CLASS_NAME.compact }}>
              <Form.Item
                name="reason"
                label={t('Change reason')}
                rules={[{ required: true, min: 3, max: 500 }]}
              >
                <Input.TextArea rows={3} maxLength={500} />
              </Form.Item>
            </Card>
          ),
        }}
      />
      {canRead ? (
        <Card title={t('Checkout-impacting health')}>
          {healthLoading ? (
            <p>{t('Loading operational health…')}</p>
          ) : healthError ? (
            <Alert
              type="warning"
              showIcon
              title={t('Operational health could not be loaded')}
              description={localizeError(healthError)}
              action={<Button onClick={() => void loadHealth()}>{t('Retry health check')}</Button>}
            />
          ) : health ? (
            <Space wrap>
              <Tag color={health.status === 'ok' ? 'success' : 'error'}>
                {t(health.status === 'ok' ? 'Healthy' : 'Degraded')}
              </Tag>
              {Object.entries(health.failures).map(([key, value]) => (
                <span key={key}>
                  {t(HEALTH_FAILURE_LABEL[key as keyof OperationalHealth['failures']])}:{' '}
                  <strong>{value}</strong>
                </span>
              ))}
            </Space>
          ) : null}
        </Card>
      ) : null}
    </div>
  )
}
