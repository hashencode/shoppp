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
import { FormSubmitToolbar } from '../../shared/components/form-submit-toolbar'
import { FORM_ERROR_SCROLL_OPTIONS, TemplateFormStateGate } from '../../shared/template-kit/form'
import { FORM_CARD_BODY_WIDTH_CLASS_NAME } from '../../shared/template-kit/form/form-content-width'
import { CustomPageRecipe } from '../../shared/template-kit/recipes/custom-page-recipe'

void React

type FormValues = LaunchConfiguration & { reason: string }
const HEALTH_FAILURE_LABEL: Record<keyof OperationalHealth['failures'], string> = {
  catalogBuilds: 'Catalog build failures',
  deadLetterJobs: 'Dead-letter jobs',
  paymentEvents: 'Payment event failures',
  reportExports: 'Report export failures',
}
const SECTION_IDS = ['sales', 'payment', 'policies']

export const LaunchSettingsPage = () => {
  const { message, modal } = App.useApp()
  const { t } = useI18n()
  const translateNow = useCurrentTranslate()
  const localizeError = useLocalizedApiError()
  const { role, permissions } = useAuth()
  const canRead = hasPermission(role, 'settings.read', permissions)
  const canWrite = hasPermission(role, 'settings.write', permissions)
  const canReadPolicies = hasPermission(role, 'policies.read', permissions)
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
  const mutationLock = useRef(false)
  const configurationRequest = useRef(0)
  const healthRequest = useRef(0)
  const hasUserEdits = useRef(false)

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
      hasUserEdits.current = false
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

  const ownerLink = (path: string, label: string) => (
    <Link
      to={{ pathname: path, search: location.search }}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
          return
        if (!hasUserEdits.current || !status) return
        const changed = Object.entries(form.getFieldsValue()).some(([key, value]) =>
          key === 'policies'
            ? Object.entries(value as LaunchConfiguration['policies']).some(
                ([policy, url]) =>
                  status.configuration.policies[policy as keyof LaunchConfiguration['policies']] !==
                  url
              )
            : JSON.stringify(value) !==
              JSON.stringify(
                key === 'reason' ? '' : status.configuration[key as keyof LaunchConfiguration]
              )
        )
        if (!changed) return
        event.preventDefault()
        modal.confirm({
          title: t('Leave with unsaved business settings?'),
          content: t('Continuing discards your unsaved business settings.'),
          okText: t('Discard changes and continue'),
          onOk: () => navigate({ pathname: path, search: location.search }),
        })
      }}
    >
      {t(label)}
    </Link>
  )

  const mode = canWrite ? 'modify' : 'readonly'
  const modeView = getFormModeViewModel(mode)
  return (
    <CustomPageRecipe
      title={t('Commercial settings')}
      extra={canRead ? ownerLink('/settings/contact', 'Contact settings') : null}
    >
      <TemplateFormStateGate
        parsedMode={{ ok: true, mode, resourceKey: 'commercial-configuration' }}
        modeView={modeView}
        permissionDenied={!canRead}
        detailLoading={loading}
        detailError={configurationError}
        onBackToList={() => navigate('/')}
        onRetryDetail={() => void loadConfiguration()}
      >
        <Form<FormValues>
          form={form}
          layout="vertical"
          initialValues={{}}
          className="space-y-4"
          disabled={!canWrite || submitting}
          scrollToFirstError={FORM_ERROR_SCROLL_OPTIONS}
          onValuesChange={() => {
            hasUserEdits.current = true
          }}
          onFinish={async ({ reason, ...configuration }) => {
            if (!canRead || !canWrite || submitting || !status || mutationLock.current) return
            mutationLock.current = true
            setSubmitting(true)
            try {
              const updated = await updateLaunchConfiguration(
                { ...status.configuration, ...configuration },
                reason
              )
              setStatus(updated)
              form.setFieldsValue({ ...updated.configuration, reason: '' })
              hasUserEdits.current = false
              void message.success(translateNow('Business settings saved.'))
            } catch (error) {
              void message.error(localizeError(error))
            } finally {
              mutationLock.current = false
              setSubmitting(false)
            }
          }}
        >
          <Card
            title={<span id="sales">{t('Sales and inventory')}</span>}
            extra={ownerLink('/settings/shipping', 'Shipping settings')}
            classNames={{ body: FORM_CARD_BODY_WIDTH_CLASS_NAME.compact }}
          >
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
              <Select options={['deny', 'limited'].map((value) => ({ label: t(value), value }))} />
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
          </Card>
          <Card
            title={<span id="payment">{t('Payments')}</span>}
            classNames={{ body: FORM_CARD_BODY_WIDTH_CLASS_NAME.compact }}
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
            <Form.Item name="paymentMode" label={t('Payment mode')}>
              <Select options={['test', 'live'].map((value) => ({ label: t(value), value }))} />
            </Form.Item>
            <Space wrap>
              <span>
                {t('Provider credential')}:{' '}
                <Tag>{t(status?.configuration.providerConfigured ? 'configured' : 'missing')}</Tag>
              </span>
              <span>
                {t('Webhook credential')}:{' '}
                <Tag>{t(status?.configuration.webhookConfigured ? 'configured' : 'missing')}</Tag>
              </span>
            </Space>
          </Card>
          <Card
            title={<span id="policies">{t('Policies')}</span>}
            extra={canReadPolicies ? ownerLink('/settings/policies', 'Edit policy content') : null}
            classNames={{ body: FORM_CARD_BODY_WIDTH_CLASS_NAME.compact }}
          >
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
            <Form.Item name="legalApproved" label={t('Legal approval')} valuePropName="checked">
              <Switch />
            </Form.Item>
          </Card>
          <Card classNames={{ body: FORM_CARD_BODY_WIDTH_CLASS_NAME.compact }}>
            <Form.Item
              name="reason"
              label={t('Change reason')}
              rules={[{ required: true, min: 3, max: 500 }]}
            >
              <Input.TextArea rows={3} maxLength={500} />
            </Form.Item>
          </Card>
          {modeView.showActions ? (
            <FormSubmitToolbar
              submitHtmlType="submit"
              submitLoading={submitting}
              submitDisabled={submitting || !canWrite}
              submitDescription={t(
                'Changes apply to new checkout requests in the current environment.'
              )}
              onReset={() => {
                if (canWrite && status) {
                  form.setFieldsValue({ ...status.configuration, reason: '' })
                  hasUserEdits.current = false
                }
              }}
            />
          ) : null}
        </Form>
      </TemplateFormStateGate>
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
    </CustomPageRecipe>
  )
}
