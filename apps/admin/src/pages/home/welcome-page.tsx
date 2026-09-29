import {
  SETUP_GUIDE_CHECKS,
  type SetupGuideCheck,
  type SetupGuideDestination,
  type SetupGuideDestinations,
  type SetupGuideSummary,
} from '@shoppp/contracts'
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  LockOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { Alert, Button, Card, Collapse, Statistic, Tag, Tooltip, Typography } from 'antd'
import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { fetchSetupGuide, fetchSetupGuideDestinations } from '../../services/platform/api'
import { useI18n } from '../../shared/contexts/i18n-context'
import { CustomPageRecipe } from '../../shared/template-kit/recipes/custom-page-recipe'

void React

type Step = SetupGuideCheck['step']
type CheckStatus = SetupGuideCheck['status']
type DestinationId = SetupGuideDestination['id']
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
    description: 'Review storefront presentation and commercial policy accuracy.',
  },
  {
    key: 'review',
    title: 'Review before launch',
    description:
      'Review inventory and runtime settings. Production release follows the existing process.',
  },
]
const MANUAL_TASK: Partial<
  Record<Step, { label: string; description: string; destinations: DestinationId[] }>
> = {
  storefront: {
    label: 'Storefront preview and policy content',
    description: 'Confirm brand content and policy text in the storefront preview.',
    destinations: ['themes', 'policies'],
  },
  review: {
    label: 'Complete shopping journey',
    description:
      'Place a test order in the test storefront to verify delivery, payment and order confirmation; review the result in Admin.',
    destinations: ['orders'],
  },
}
const CHECK_LABEL: Record<SetupGuideCheck['id'], string> = {
  configuration_saved: 'Commercial configuration saved',
  contact_details: 'Public contact channel confirmed',
  sellable_sku: 'At least one sellable SKU',
  sellable_currencies: 'Price lists for enabled currencies',
  shipping_countries: 'Enabled shipping countries',
  shipping_methods: 'Selected shipping methods',
  shipping_country_methods: 'Country and shipping method links',
  payment_configuration: 'Payment configuration',
  policy_configuration: 'Commercial policy links and approval',
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
const STATUS_ICON = {
  passed: CheckCircleOutlined,
  needs_action: ExclamationCircleOutlined,
  unavailable: WarningOutlined,
  restricted: LockOutlined,
} as const
const STATUS_ICON_CLASS: Record<CheckStatus, string> = {
  passed: 'text-green-600',
  needs_action: 'text-amber-600',
  unavailable: 'text-red-600',
  restricted: 'text-slate-500',
}
const REASON_MESSAGE: Record<string, string> = {
  configuration_not_saved:
    'Default configuration has not been confirmed. Review and save commercial settings.',
  contact_details_invalid: 'Enter valid support and privacy contact email addresses.',
  public_contact_not_confirmed:
    'Confirm at least one public email or phone number in contact settings.',
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
const DESTINATION_LABEL: Record<DestinationId, string> = {
  identity: 'Store identity',
  contact: 'Contact settings',
  policies: 'Policies',
  products: 'Products',
  collections: 'Collections',
  pages: 'Pages',
  articles: 'Articles',
  navigation: 'Navigation',
  themes: 'Themes and preview',
  shipping: 'Shipping settings',
  commerce: 'Commercial settings',
  inventory: 'Inventory',
  orders: 'Orders',
}
const CHECK_TARGET: Partial<
  Record<SetupGuideCheck['id'], { destination: DestinationId; anchor?: string; label?: string }>
> = {
  configuration_saved: { destination: 'commerce', anchor: 'sales' },
  contact_details: { destination: 'contact' },
  sellable_sku: { destination: 'products' },
  sellable_currencies: { destination: 'products' },
  shipping_countries: { destination: 'shipping' },
  shipping_methods: { destination: 'shipping' },
  shipping_country_methods: { destination: 'shipping' },
  policy_configuration: { destination: 'commerce', anchor: 'policies', label: 'Policy settings' },
  oversell_policy: { destination: 'commerce', anchor: 'sales', label: 'Sales and inventory' },
  reservation_ttl: { destination: 'commerce', anchor: 'sales', label: 'Sales and inventory' },
}
const EDITOR_GROUPS: { title: string; destinations: DestinationId[] }[] = [
  {
    title: 'Store settings',
    destinations: ['identity', 'contact', 'commerce', 'shipping', 'policies'],
  },
  {
    title: 'Catalog and operations',
    destinations: ['products', 'collections', 'inventory', 'orders'],
  },
  { title: 'Content and storefront', destinations: ['pages', 'articles', 'navigation', 'themes'] },
]
const UNCHECKED_DESTINATIONS = new Set<DestinationId>([
  'identity',
  'collections',
  'pages',
  'articles',
  'navigation',
])
const targetForCheck = (check: SetupGuideCheck) => {
  if (check.id === 'payment_configuration') {
    return check.reasons.some((reason) => reason.code === 'production_payment_mode_not_live')
      ? { destination: 'commerce' as const, anchor: 'payment', label: 'Payments' }
      : undefined
  }
  return CHECK_TARGET[check.id]
}
const ALL_STEPS = STEPS.map((step) => step.key)
const failedChecks = (status: 'unavailable' | 'restricted'): SetupGuideCheck[] =>
  SETUP_GUIDE_CHECKS.map((check) => ({
    ...check,
    status,
    reasons: [{ code: status === 'restricted' ? 'permission_denied' : 'check_failed' }],
  }))

type CheckResult = {
  request: { key: string; scope: string }
  summary?: SetupGuideSummary
  errorStatus?: number
  failed?: boolean
  destinations?: SetupGuideDestinations
  destinationsFailed?: boolean
}

const DestinationLink = ({
  destination,
  anchor,
  label,
}: {
  destination: SetupGuideDestination
  anchor?: string
  label?: string
}) => {
  const { t } = useI18n()
  return (
    <Link
      to={`${destination.href}${anchor ? `#${anchor}` : ''}`}
      className="inline-flex items-center gap-1 !text-blue-700 hover:!text-blue-800 hover:underline focus-visible:underline"
    >
      {t('Go to {destination}', { destination: t(label ?? DESTINATION_LABEL[destination.id]) })}
      <ArrowRightOutlined aria-hidden="true" />
    </Link>
  )
}

export const WelcomePage = () => {
  const { t } = useI18n()
  const { permissions, role, refreshSession } = useAuth()
  const location = useLocation()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [expanded, setExpanded] = useState<string[]>([])
  const canRead = hasPermission(role, 'settings.read', permissions)
  const requestScope = `${location.key}:${role}:${[...(permissions ?? [])].sort().join(',')}`
  const requestKey = `${requestScope}:${attempt}`
  // History can reuse a location key; each transition needs a fresh request identity.
  const request = useMemo(
    () => ({ key: requestKey, scope: requestScope }),
    [requestKey, requestScope]
  )

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    void Promise.allSettled([
      fetchSetupGuideDestinations(controller.signal),
      canRead ? fetchSetupGuide(controller.signal) : Promise.resolve(null),
    ]).then(([destinations, checks]) => {
      if (!active) return
      const next: CheckResult = { request }
      if (destinations.status === 'fulfilled') next.destinations = destinations.value
      else next.destinationsFailed = true
      if (canRead) {
        const nextSummary = checks.status === 'fulfilled' ? checks.value : null
        if (nextSummary) {
          next.summary = nextSummary
          setExpanded(
            STEPS.filter((step) =>
              nextSummary.checks.some(
                (check) => check.step === step.key && check.status !== 'passed'
              )
            ).map((step) => step.key)
          )
        } else {
          next.failed = true
          next.errorStatus =
            checks.status === 'rejected'
              ? (checks.reason as { status?: number } | null)?.status
              : undefined
          setExpanded(ALL_STEPS)
        }
      }
      setResult(next)
    })
    return () => {
      active = false
      controller.abort()
    }
  }, [canRead, request])

  // Rechecks keep the last complete result for this scope until both requests finish.
  const current = result?.request === request ? result : null
  const displayed = current ?? (result?.request.scope === requestScope ? result : null)
  const availableDestinations = displayed?.destinations?.destinations ?? []
  const browseDestinations = canRead
    ? availableDestinations.filter((destination) => UNCHECKED_DESTINATIONS.has(destination.id))
    : availableDestinations
  const initialLoading = canRead && !displayed
  const recheck = () => setAttempt((value) => value + 1)
  const restricted = !canRead || displayed?.errorStatus === 401 || displayed?.errorStatus === 403
  const summary = canRead && !restricted ? displayed?.summary : undefined
  const checks =
    summary?.checks ??
    (initialLoading ? [] : failedChecks(restricted ? 'restricted' : 'unavailable'))
  const passedCount = checks.filter((check) => check.status === 'passed').length
  const statusTag = (status: CheckStatus) => (
    <Tag color={STATUS_COLOR[status]}>{t(STATUS_LABEL[status])}</Tag>
  )
  const statusIcon = (status?: CheckStatus) => {
    const label = t(status ? STATUS_LABEL[status] : 'Checking…')
    const Icon = status ? STATUS_ICON[status] : LoadingOutlined
    return (
      <Tooltip title={label}>
        <span
          role="img"
          aria-label={label}
          className={`inline-flex items-center text-lg ${status ? STATUS_ICON_CLASS[status] : ''}`}
        >
          <Icon aria-hidden="true" spin={!status} />
        </span>
      </Tooltip>
    )
  }
  const pendingCount = checks.filter((check) => check.status === 'needs_action').length
  const unavailableCount = checks.filter((check) => check.status === 'unavailable').length
  const restrictedCount = checks.filter((check) => check.status === 'restricted').length

  return (
    <CustomPageRecipe>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Statistic
            loading={initialLoading}
            title={t('Passed automatic checks')}
            value={summary ? passedCount : '—'}
            suffix={`/${SETUP_GUIDE_CHECKS.length}`}
          />
          <Button onClick={recheck} loading={!current}>
            {t('Recheck')}
          </Button>
        </div>
        {summary ? (
          <Typography.Paragraph className="!mb-0 mt-3">
            {t('Needs action')}: {pendingCount} · {t('Unable to check')}: {unavailableCount} ·{' '}
            {t('No permission to check')}: {restrictedCount}
          </Typography.Paragraph>
        ) : null}
        <Typography.Paragraph className="!mb-0 mt-3" type="secondary">
          {t(
            'These 13 checks cover initial store setup. Open each editor to review draft, published, candidate and live state.'
          )}
        </Typography.Paragraph>
        {passedCount === SETUP_GUIDE_CHECKS.length ? (
          <Typography.Paragraph className="!mb-0 mt-3">
            {t('Current configuration checks passed; manual verification is still required.')}
          </Typography.Paragraph>
        ) : null}
        {displayed?.failed || !canRead ? (
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
              displayed?.errorStatus === 401 ? (
                <Button onClick={() => void refreshSession()}>{t('Verify session')}</Button>
              ) : undefined
            }
          />
        ) : null}
        {displayed?.destinationsFailed ? (
          <Alert
            className="mt-3"
            showIcon
            type="error"
            title={t('Setup destinations could not be loaded')}
            action={
              <Button onClick={recheck} loading={!current}>
                {t('Retry')}
              </Button>
            }
          />
        ) : null}
        {!displayed ? (
          <Typography.Paragraph className="!mb-0 mt-3" type="secondary">
            {t('Loading setup destinations…')}
          </Typography.Paragraph>
        ) : null}
      </Card>
      <Collapse
        activeKey={expanded}
        onChange={(keys) => setExpanded(typeof keys === 'string' ? [keys] : keys)}
        items={STEPS.map((step, index) => {
          const stepChecks = checks.filter((check) => check.step === step.key)
          const manualTask = MANUAL_TASK[step.key]
          const stepStatus = (
            ['unavailable', 'restricted', 'needs_action', 'passed'] as const
          ).find((status) => stepChecks.some((check) => check.status === status))
          return {
            key: step.key,
            label: `${index + 1}. ${t(step.title)}`,
            extra: statusIcon(stepStatus),
            children: (
              <div className="space-y-3">
                <Typography.Paragraph className="!mb-0">{t(step.description)}</Typography.Paragraph>
                <ul className="m-0 list-disc space-y-3 pl-5">
                  {stepChecks.map((check) => {
                    const target =
                      check.status === 'needs_action' ? targetForCheck(check) : undefined
                    const destination =
                      target && availableDestinations.find((item) => item.id === target.destination)
                    return (
                      <li key={check.id}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{t(CHECK_LABEL[check.id])}</span>
                          {statusTag(check.status)}
                          {destination ? (
                            <DestinationLink
                              destination={destination}
                              anchor={target.anchor}
                              label={target.label}
                            />
                          ) : null}
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
                        {check.status === 'needs_action' &&
                        check.id === 'payment_configuration' &&
                        check.reasons.some(
                          (reason) =>
                            reason.code === 'payment_provider_missing' ||
                            reason.code === 'payment_webhook_missing'
                        ) ? (
                          <Typography.Paragraph className="!mb-0 mt-1" type="secondary">
                            {t(
                              'Ask the deployment maintainer to configure the environment credentials.'
                            )}
                          </Typography.Paragraph>
                        ) : null}
                        {check.status === 'needs_action' &&
                        (check.id === 'turnstile_configuration' ||
                          check.id === 'backup_configuration') ? (
                          <Typography.Paragraph className="!mb-0 mt-1" type="secondary">
                            {t(
                              'Ask the deployment maintainer to configure the missing runtime bindings.'
                            )}
                          </Typography.Paragraph>
                        ) : null}
                      </li>
                    )
                  })}
                  {manualTask ? (
                    <li>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{t(manualTask.label)}</span>
                        <Tag>{t('Manual check')}</Tag>
                        {availableDestinations
                          .filter((destination) => manualTask.destinations.includes(destination.id))
                          .map((destination) => (
                            <DestinationLink key={destination.id} destination={destination} />
                          ))}
                      </div>
                      <Typography.Paragraph className="!mb-0 mt-1" type="secondary">
                        {t(manualTask.description)}
                      </Typography.Paragraph>
                    </li>
                  ) : null}
                </ul>
              </div>
            ),
          }
        })}
      />
      {browseDestinations.length ? (
        <Card title={t(canRead ? 'Other setup areas' : 'Available editors')}>
          <Typography.Paragraph type="secondary">
            {t(
              canRead
                ? 'These areas are outside the 13 automatic checks. Review draft, published, candidate and live state in each editor.'
                : 'You can open the editors allowed for your account. Setup check conclusions require settings access.'
            )}
          </Typography.Paragraph>
          <div className="grid gap-6 md:grid-cols-3">
            {EDITOR_GROUPS.map((group) => {
              const destinations = browseDestinations.filter((destination) =>
                group.destinations.includes(destination.id)
              )
              return destinations.length ? (
                <section key={group.title}>
                  <Typography.Title level={5}>{t(group.title)}</Typography.Title>
                  <ul className="m-0 space-y-2 p-0" style={{ listStyle: 'none' }}>
                    {destinations.map((destination) => (
                      <li key={destination.id}>
                        <DestinationLink destination={destination} />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null
            })}
          </div>
        </Card>
      ) : null}
    </CustomPageRecipe>
  )
}
