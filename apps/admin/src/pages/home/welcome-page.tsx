import { SETUP_GUIDE_CHECKS, type SetupGuideCheck, type SetupGuideSummary } from '@shoppp/contracts'
import { Alert, Button, Card, Collapse, Space, Tag, Typography } from 'antd'
import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { hasPermission, type PermissionKey } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { fetchSetupGuide } from '../../services/platform/api'
import { useI18n } from '../../shared/contexts/i18n-context'
import { CustomPageRecipe } from '../../shared/template-kit/recipes/custom-page-recipe'

void React

type Step = SetupGuideCheck['step']
type CheckStatus = SetupGuideCheck['status']
const STEPS: { key: Step; title: string; description: string }[] = [
  {
    key: 'contacts',
    title: 'Basics and contacts',
    description: 'Confirm the contact details used by shoppers and privacy requests.',
  },
  {
    key: 'products',
    title: 'Prepare products',
    description:
      'At least one published SKU needs a current price and available stock in the configured default currency. This does not check the entire catalog.',
  },
  {
    key: 'shipping',
    title: 'Set up delivery',
    description:
      'Every enabled country needs a selected, active shipping method in its zone. Verify actual cart quotes with a test order.',
  },
  {
    key: 'payment',
    title: 'Set up payments',
    description:
      'Configuration checks cover credential formats and the environment payment mode. They do not verify a payment or webhook delivery.',
  },
  {
    key: 'storefront',
    title: 'Storefront and policies',
    description:
      'Check policy links and approval, then review the storefront through the existing theme workflow.',
  },
  {
    key: 'review',
    title: 'Review before launch',
    description:
      'Review inventory and runtime settings, then complete the manual checks. Production release follows the existing process.',
  },
]
const CHECK_LABEL: Record<SetupGuideCheck['id'], string> = {
  configuration_saved: 'Commercial configuration saved',
  contact_details: 'Contact email formats',
  sellable_sku: 'At least one sellable SKU',
  sellable_currencies: 'Price lists for enabled currencies',
  shipping_countries: 'Enabled shipping countries',
  shipping_methods: 'Selected shipping methods',
  shipping_country_methods: 'Country and shipping method links',
  payment_configuration: 'Payment configuration',
  policy_configuration: 'Policy configuration',
  oversell_policy: 'Oversell policy',
  reservation_ttl: 'Inventory reservation duration',
  turnstile_configuration: 'Turnstile configuration',
  backup_configuration: 'Backup configuration',
}
const STATUS_LABEL: Record<CheckStatus, string> = {
  passed: 'Passed',
  needs_action: 'Needs action',
  unavailable: 'Unable to check',
  restricted: 'No permission to check',
}
const STATUS_COLOR: Record<CheckStatus, string> = {
  passed: 'success',
  needs_action: 'warning',
  unavailable: 'error',
  restricted: 'default',
}
const REASON_MESSAGE: Record<string, string> = {
  configuration_not_saved:
    'Default configuration has not been confirmed. Review and save commercial settings.',
  contact_details_invalid: 'Enter valid support and privacy contact email addresses.',
  no_sellable_sku:
    'No published SKU has a current price and available stock in the default currency.',
  legal_approval_missing: 'Legal approval for the published policies is required.',
  payment_provider_missing: 'The payment provider credential is not configured.',
  payment_webhook_missing: 'The payment webhook credential is not configured.',
  production_payment_mode_not_live: 'Production must use the live payment provider mode.',
  placeholder_policy_url: 'Production policy links cannot use placeholder domains.',
  policy_links_invalid: 'Enter valid policy links.',
  sellable_currency_unavailable: 'Every sellable currency must have an active price list.',
  shipping_country_unavailable: 'Every enabled country must belong to an active shipping zone.',
  shipping_method_unavailable:
    'Every enabled shipping method must exist in an active shipping zone.',
  shipping_country_method_missing:
    'These countries have no selected active shipping method in their zone: {countries}.',
  oversell_policy_mismatch:
    'Inventory oversell limits must be zero when the launch policy denies oversell.',
  reservation_ttl_mismatch: 'The launch reservation duration must match the Worker runtime value.',
  turnstile_site_key_missing:
    'Turnstile is required but its environment-specific public site key is missing.',
  turnstile_secret_missing: 'Turnstile is required but its server-side secret is not configured.',
  backup_export_missing: 'The scheduled D1 export credential or target binding is not configured.',
  configuration_unavailable: 'The current configuration could not be read. Retry the check.',
  check_failed: 'This check could not be completed. Retry the check.',
  permission_denied: 'Your account does not have permission to read this check.',
}
const ENVIRONMENT_LABEL: Record<SetupGuideSummary['environment'], string> = {
  development: 'Development',
  staging: 'Staging',
  production: 'Production',
}
const ALL_STEPS = STEPS.map((step) => step.key)
const failedChecks = (status: 'unavailable' | 'restricted'): SetupGuideCheck[] =>
  SETUP_GUIDE_CHECKS.map((check) => ({
    ...check,
    status,
    reasons: [{ code: status === 'restricted' ? 'permission_denied' : 'check_failed' }],
  }))

type CheckResult = {
  request: { key: string }
  summary?: SetupGuideSummary
  errorStatus?: number
  failed?: boolean
}

export const WelcomePage = () => {
  const { t, locale } = useI18n()
  const { permissions, role, refreshSession } = useAuth()
  const location = useLocation()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [visible, setVisible] = useState(true)
  const [expanded, setExpanded] = useState<string[]>(ALL_STEPS)
  const canRead = hasPermission(role, 'settings.read', permissions)
  const requestKey = `${location.key}:${attempt}:${[...(permissions ?? [])].sort().join(',')}`
  // History can reuse a location key; each transition needs a fresh request identity.
  const request = useMemo(() => ({ key: requestKey }), [requestKey])

  useEffect(() => {
    if (!canRead) return
    let active = true
    void fetchSetupGuide().then(
      (summary) => {
        if (!active) return
        setResult({ request, summary })
        if (summary.checks.some((check) => check.status !== 'passed')) {
          setVisible(true)
          setExpanded(ALL_STEPS)
        }
      },
      (error: unknown) => {
        if (!active) return
        const errorStatus = (error as { status?: number } | null)?.status
        setResult({ request, failed: true, errorStatus })
        setVisible(true)
        setExpanded(ALL_STEPS)
      }
    )
    return () => {
      active = false
    }
  }, [canRead, request])

  // A new request or permission snapshot cannot display the previous request's conclusions.
  const current = result?.request === request ? result : null
  const loading = canRead && !current
  const restricted = !canRead || current?.errorStatus === 401 || current?.errorStatus === 403
  const summary = canRead && !restricted ? current?.summary : undefined
  const checks =
    summary?.checks ?? (loading ? [] : failedChecks(restricted ? 'restricted' : 'unavailable'))
  const counts = { passed: 0, needs_action: 0, unavailable: 0, restricted: 0 }
  for (const check of checks) counts[check.status] += 1
  const can = (permission: PermissionKey) =>
    !restricted && hasPermission(role, permission, permissions)
  const date = (value: string) => new Date(value).toLocaleString(locale)
  const statusTag = (status: CheckStatus) => (
    <Tag color={STATUS_COLOR[status]}>{t(STATUS_LABEL[status])}</Tag>
  )
  const settingsLink = (anchor: string, label: string) =>
    can('settings.read') ? (
      <Link to={`/settings/launch?from=setup-guide#${anchor}`}>{t(label)}</Link>
    ) : null
  const actions = (step: Step) => {
    switch (step) {
      case 'contacts':
        return settingsLink('contacts', 'Contact settings')
      case 'products':
        return (
          <>
            {can('catalog.read') ? (
              <Link to="/catalog/products?from=setup-guide">{t('Manage products')}</Link>
            ) : null}
            {can('inventory.read') ? <Link to="/inventory">{t('View inventory')}</Link> : null}
            {settingsLink('sales', 'Sales settings')}
          </>
        )
      case 'shipping':
        return (
          <>
            {can('settings.read') ? (
              <Link to="/settings/shipping?from=setup-guide">{t('Shipping settings')}</Link>
            ) : null}
            {settingsLink('sales', 'Sales and delivery scope')}
          </>
        )
      case 'payment':
        return settingsLink('payment', 'Payment settings')
      case 'storefront':
        return (
          <>
            {can('themes.read') ? (
              <Link to="/storefront/themes?from=setup-guide">{t('Manage storefront themes')}</Link>
            ) : null}
            {settingsLink('policies', 'Policy settings')}
          </>
        )
      case 'review':
        return (
          <>
            {settingsLink('sales', 'Inventory and reservation settings')}
            {can('orders.read') ? <Link to="/orders">{t('View orders')}</Link> : null}
          </>
        )
    }
  }

  return (
    <CustomPageRecipe
      extra={
        can('reporting.read') ? <Link to="/dashboard">{t('Commerce dashboard')}</Link> : undefined
      }
    >
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Typography.Paragraph strong className="!mb-2">
              {loading
                ? t('Checking {total} automatic checks…', { total: SETUP_GUIDE_CHECKS.length })
                : t('Automatic checks passed: {passed}/{total}', {
                    passed: counts.passed,
                    total: SETUP_GUIDE_CHECKS.length,
                  })}
            </Typography.Paragraph>
            {!loading ? (
              <Typography.Paragraph className="!mb-2">
                {t(
                  'Needs action: {action} · Unable to check: {unavailable} · No permission: {restricted}',
                  {
                    action: counts.needs_action,
                    unavailable: counts.unavailable,
                    restricted: counts.restricted,
                  }
                )}
              </Typography.Paragraph>
            ) : null}
          </div>
          <Space wrap>
            {canRead ? (
              <Button onClick={() => setAttempt((value) => value + 1)} loading={loading}>
                {t('Recheck')}
              </Button>
            ) : null}
            <Button onClick={() => setVisible((value) => !value)}>
              {t(visible ? 'Collapse guide' : 'Expand guide')}
            </Button>
          </Space>
        </div>
        {summary ? (
          <Typography.Paragraph type="secondary" className="!mb-0">
            {t('Environment: {environment} · Checked: {time}', {
              environment: t(ENVIRONMENT_LABEL[summary.environment]),
              time: date(summary.checkedAt),
            })}
            <br />
            {summary.configuration
              ? t('Default currency: {currency} · Configuration saved: {time}', {
                  currency: summary.configuration.defaultCurrency,
                  time: summary.configuration.updatedAt
                    ? date(summary.configuration.updatedAt)
                    : t('Not yet saved'),
                })
              : t('Configuration context is unavailable.')}
          </Typography.Paragraph>
        ) : null}
        {counts.passed === SETUP_GUIDE_CHECKS.length ? (
          <Typography.Paragraph className="!mb-0 mt-3">
            {t('Current configuration checks passed; manual verification is still required.')}
          </Typography.Paragraph>
        ) : null}
        {current?.failed || !canRead ? (
          <Alert
            className="mt-3"
            showIcon
            type={restricted ? 'warning' : 'error'}
            title={t(
              restricted ? 'Setup checks are not authorized.' : 'Setup checks could not be loaded.'
            )}
            description={t(
              'Previous results have been cleared. Recheck after access or connectivity is restored.'
            )}
            action={
              current?.errorStatus === 401 ? (
                <Button onClick={() => void refreshSession()}>{t('Verify session')}</Button>
              ) : undefined
            }
          />
        ) : null}
      </Card>
      {visible ? (
        <Collapse
          activeKey={expanded}
          onChange={(keys) => setExpanded(typeof keys === 'string' ? [keys] : keys)}
          items={STEPS.map((step, index) => {
            const stepChecks = checks.filter((check) => check.step === step.key)
            const stepStatus = (
              ['unavailable', 'restricted', 'needs_action', 'passed'] as const
            ).find((status) => stepChecks.some((check) => check.status === status))
            return {
              key: step.key,
              label: `${index + 1}. ${t(step.title)}`,
              extra: stepStatus ? statusTag(stepStatus) : <Tag>{t('Checking…')}</Tag>,
              children: (
                <div className="space-y-3">
                  <Typography.Paragraph>{t(step.description)}</Typography.Paragraph>
                  <ul className="m-0 list-none space-y-3 p-0">
                    {stepChecks.map((check) => (
                      <li key={check.id}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{t(CHECK_LABEL[check.id])}</span>
                          {statusTag(check.status)}
                        </div>
                        {check.reasons.map((reason, reasonIndex) => (
                          <Typography.Paragraph
                            className="!mb-0 mt-1"
                            type="secondary"
                            key={`${reason.code}-${reasonIndex}`}
                          >
                            {t(
                              REASON_MESSAGE[reason.code] ??
                                'This check needs further attention. Review the corresponding settings.',
                              { countries: reason.countries?.join(', ') ?? '' }
                            )}
                          </Typography.Paragraph>
                        ))}
                      </li>
                    ))}
                  </ul>
                  {step.key === 'payment' &&
                  stepChecks.some((check) =>
                    check.reasons.some(
                      (reason) =>
                        reason.code === 'payment_provider_missing' ||
                        reason.code === 'payment_webhook_missing'
                    )
                  ) ? (
                    <Typography.Paragraph>
                      {t('Ask the deployment maintainer to configure the environment credentials.')}
                    </Typography.Paragraph>
                  ) : null}
                  {step.key === 'storefront' ? (
                    <Typography.Paragraph>
                      {t('Preview the storefront and confirm the brand content and policy text.')}
                    </Typography.Paragraph>
                  ) : null}
                  {step.key === 'review' ? (
                    <Typography.Paragraph>
                      {t(
                        'Check the complete shopping journey, including delivery, payment and order confirmation, through the existing test-order process.'
                      )}
                    </Typography.Paragraph>
                  ) : null}
                  <Space wrap>{actions(step.key)}</Space>
                </div>
              ),
            }
          })}
        />
      ) : null}
    </CustomPageRecipe>
  )
}
