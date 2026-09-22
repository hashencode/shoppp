import {
  contactSocialPlatformLabels,
  type ContactProfile,
  type ContactSettings,
} from '@shoppp/contracts'
import { Alert, App, Button, Card, Form, Input, Select, Space, Switch, Typography } from 'antd'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError, type ApiError } from '../../infrastructure/http/api-client'
import { getFormModeViewModel } from '../../routes/form-route-contract'
import { fetchContactSettings, updateContactSettings } from '../../services/platform/api'
import { FormSubmitToolbar } from '../../shared/components/form-submit-toolbar'
import { useCurrentTranslate, useI18n } from '../../shared/contexts/i18n-context'
import { useLocalizedApiError } from '../../shared/i18n/api-error'
import { FORM_ERROR_SCROLL_OPTIONS, TemplateFormStateGate } from '../../shared/template-kit/form'
import { FORM_CARD_BODY_WIDTH_CLASS_NAME } from '../../shared/template-kit/form/form-content-width'
import { CustomPageRecipe } from '../../shared/template-kit/recipes/custom-page-recipe'
import { getTimeZoneOptions } from '../../shared/utils/time-zones'

void React

type FormValues = {
  supportEmail: string
  privacyContactEmail: string
  profile: ContactProfile
}

const optional = (value: string | null | undefined) => value?.trim() || null
const phonePattern = /^\+[1-9]\d{1,14}$/
const httpsRule = (message: string) => ({
  validator: (_: unknown, value: string | null | undefined) => {
    if (!value) return Promise.resolve()
    try {
      const url = new URL(value)
      if (url.protocol === 'https:' && !url.username && !url.password) return Promise.resolve()
    } catch {
      /* The validation message below covers malformed URLs. */
    }
    return Promise.reject(new Error(message))
  },
})
const weekdayOptions = [
  ['monday', 'Monday'],
  ['tuesday', 'Tuesday'],
  ['wednesday', 'Wednesday'],
  ['thursday', 'Thursday'],
  ['friday', 'Friday'],
  ['saturday', 'Saturday'],
  ['sunday', 'Sunday'],
] as const
const socialPlatformOptions = Object.entries(contactSocialPlatformLabels).map(([value, label]) => ({
  label,
  value,
}))
type SocialPlatform = ContactProfile['socials'][number]['platform']
const newServiceRange = (): Extract<NonNullable<ContactProfile['serviceHours']>, { kind: 'weekly' }>['ranges'][number] => ({
  id: crypto.randomUUID(),
  startDay: 'monday',
  endDay: 'friday',
  startTime: '09:00',
  endTime: '18:00',
})
const newLocation = (): ContactProfile['locations'][number] => ({
  id: crypto.randomUUID(),
  name: '',
  city: '',
  address: '',
  phone: null,
  email: null,
  mapUrl: null,
  visible: false,
})
const newSocial = (platform: SocialPlatform): ContactProfile['socials'][number] => ({
  id: crypto.randomUUID(),
  platform,
  label: contactSocialPlatformLabels[platform],
  url: '',
  visible: false,
})

const formatServiceHours = (serviceHours: ContactProfile['serviceHours']) => {
  if (!serviceHours) return '—'
  if (serviceHours.kind === 'legacy') return serviceHours.text
  return serviceHours.ranges
    .map((range) => {
      const startDay = weekdayOptions.find(([value]) => value === range.startDay)?.[1]
      const endDay = weekdayOptions.find(([value]) => value === range.endDay)?.[1]
      return `${startDay}–${endDay}, ${range.startTime}–${range.endTime}`
    })
    .join('; ')
}

export const ContactSettingsPage = () => {
  const { message } = App.useApp()
  const { t } = useI18n()
  const translateNow = useCurrentTranslate()
  const localizeError = useLocalizedApiError()
  const navigate = useNavigate()
  const { role, permissions } = useAuth()
  const canRead = hasPermission(role, 'settings.read', permissions)
  const canWrite = hasPermission(role, 'settings.write', permissions)
  const [form] = Form.useForm<FormValues>()
  const [serviceHours, setServiceHours] = useState<ContactProfile['serviceHours']>(null)
  const socials = Form.useWatch(['profile', 'socials'], form) ?? []
  const replaceServiceHours = (value: ContactProfile['serviceHours']) => {
    setServiceHours(value)
    const profile = form.getFieldValue('profile')
    form.setFieldsValue({
      profile: {
        ...profile,
        serviceHours: value,
        timeZone: value ? profile.timeZone : null,
      },
    })
  }
  const [settings, setSettings] = useState<ContactSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<ApiError | null>(null)
  const [saveError, setSaveError] = useState<ApiError | null>(null)
  const [latest, setLatest] = useState<ContactSettings | null>(null)
  const [comparing, setComparing] = useState(false)
  const request = useRef(0)

  const load = useCallback(async () => {
    const current = ++request.current
    setLoading(true)
    setLoadError(null)
    try {
      const result = await fetchContactSettings()
      if (current !== request.current) return
      setSettings(result)
      setServiceHours(result.profile.serviceHours)
      setSaveError(null)
      setLatest(null)
      form.setFieldsValue({
        profile: result.profile,
        supportEmail: result.supportEmail,
        privacyContactEmail: result.privacyContactEmail,
      })
    } catch (error) {
      if (current === request.current) setLoadError(normalizeApiError(error))
    } finally {
      if (current === request.current) setLoading(false)
    }
  }, [form])

  const compareLatest = async () => {
    setComparing(true)
    try {
      setLatest(await fetchContactSettings())
    } catch (error) {
      setSaveError(normalizeApiError(error))
    } finally {
      setComparing(false)
    }
  }

  const replaceWithLatest = () => {
    if (!latest) return
    setSettings(latest)
    setServiceHours(latest.profile.serviceHours)
    form.setFieldsValue({
      profile: latest.profile,
      supportEmail: latest.supportEmail,
      privacyContactEmail: latest.privacyContactEmail,
    })
    setLatest(null)
    setSaveError(null)
  }

  useEffect(() => {
    if (!canRead) return
    const timer = window.setTimeout(() => void load(), 0)
    return () => {
      window.clearTimeout(timer)
      request.current += 1
    }
  }, [canRead, load])

  const save = async (values: FormValues) => {
    if (!canWrite || !settings || saving) return
    setSaving(true)
    setSaveError(null)
    const profile: ContactProfile = {
      ...values.profile,
      publicPhone: optional(values.profile.publicPhone),
      serviceHours: values.profile.serviceHours ?? null,
      timeZone: optional(values.profile.timeZone),
      locations: (values.profile.locations ?? []).map((location) => ({
        ...location,
        phone: optional(location.phone),
        email: optional(location.email),
        mapUrl: optional(location.mapUrl),
      })),
      socials: (values.profile.socials ?? []).map((social) => ({
        ...social,
        label: contactSocialPlatformLabels[social.platform],
      })),
    }
    try {
      const updated = await updateContactSettings({
        profile,
        supportEmail: values.supportEmail,
        privacyContactEmail: values.privacyContactEmail,
        expectedLaunchVersion: settings.launchVersion,
        expectedProfileVersion: settings.profileVersion,
      })
      setSettings(updated)
      setServiceHours(updated.profile.serviceHours)
      setLatest(null)
      form.setFieldsValue({
        profile: updated.profile,
        supportEmail: updated.supportEmail,
        privacyContactEmail: updated.privacyContactEmail,
      })
      void message.success(translateNow('Contact settings saved and audited.'))
    } catch (error) {
      setSaveError(normalizeApiError(error))
    } finally {
      setSaving(false)
    }
  }

  const mode = canWrite ? 'modify' : 'readonly'
  const modeView = getFormModeViewModel(mode)

  return (
    <CustomPageRecipe title={t('Contact settings')}>
      <TemplateFormStateGate
        parsedMode={{ ok: true, mode, resourceKey: 'contact-settings' }}
        modeView={modeView}
        permissionDenied={!canRead}
        detailLoading={loading}
        detailError={loadError}
        onBackToList={() => navigate('/')}
        onRetryDetail={() => void load()}
      >
        {settings ? (
          <Form<FormValues>
            form={form}
            layout="vertical"
            className="space-y-4"
            onFinish={(values) => void save(values)}
            onFinishFailed={({ errorFields }) => {
              const firstInvalid = [...errorFields].sort((left, right) => {
                const leftField = document.getElementById(left.name.join('_'))
                const rightField = document.getElementById(right.name.join('_'))
                if (!leftField || !rightField) return 0
                if (leftField === rightField) return 0
                return leftField.compareDocumentPosition(rightField) &
                  Node.DOCUMENT_POSITION_FOLLOWING
                  ? -1
                  : 1
              })[0]?.name
              if (firstInvalid) form.scrollToField(firstInvalid, FORM_ERROR_SCROLL_OPTIONS)
            }}
            disabled={!canWrite || saving}
          >
            <Card
              title={t('Global contact channels')}
              classNames={{ body: FORM_CARD_BODY_WIDTH_CLASS_NAME.compact }}
            >
              <Typography.Paragraph type="secondary">
                {t(
                  'Only channels you explicitly publish will appear on the storefront after a new preview or release.'
                )}
              </Typography.Paragraph>
              <div className="grid">
                <Form.Item
                  name="supportEmail"
                  label={t('Support email')}
                  rules={[{ required: true, type: 'email' }]}
                >
                  <Input type="email" />
                </Form.Item>
                <Form.Item
                  name="privacyContactEmail"
                  label={t('Privacy contact email')}
                  rules={[{ required: true, type: 'email' }]}
                >
                  <Input type="email" />
                </Form.Item>
                <Form.Item
                  name={['profile', 'publishSupportEmail']}
                  label={t('Show support email publicly')}
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                <Form.Item
                  name={['profile', 'publishPrivacyEmail']}
                  label={t('Show privacy email publicly')}
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                <Form.Item
                  name={['profile', 'publicPhone']}
                  label={t('Public phone')}
                  rules={[
                    {
                      pattern: phonePattern,
                      message: t('Use an international phone number, such as +12025550123.'),
                    },
                  ]}
                >
                  <Input type="tel" placeholder="+12025550123" />
                </Form.Item>
                <div>
                  <Typography.Title level={5}>{t('Service hours')}</Typography.Title>
                  {serviceHours?.kind === 'legacy' ? (
                    <Alert
                      className="mb-4"
                      type="info"
                      showIcon
                      title={t('Legacy service hours')}
                      description={serviceHours.text}
                      action={
                        canWrite ? (
                          <Button
                            onClick={() => {
                              replaceServiceHours({
                                kind: 'weekly',
                                ranges: [newServiceRange()],
                              })
                            }}
                          >
                            {t('Replace with structured hours')}
                          </Button>
                        ) : undefined
                      }
                    />
                  ) : serviceHours?.kind === 'weekly' ? (
                    <>
                      <Form.Item name={['profile', 'serviceHours', 'kind']} hidden>
                        <Input />
                      </Form.Item>
                      <Form.List name={['profile', 'serviceHours', 'ranges']}>
                        {(fields, { add, remove }) => (
                          <div className="space-y-4">
                          {fields.map((field, index) => (
                            <Card
                              key={field.key}
                              size="small"
                              title={t('Service window {number}', { number: index + 1 })}
                            >
                              <Form.Item name={[field.name, 'id']} hidden>
                                <Input />
                              </Form.Item>
                              <Form.Item
                                name={[field.name, 'startDay']}
                                label={t('Start weekday')}
                                rules={[{ required: true }]}
                              >
                                <Select
                                  options={weekdayOptions.map(([value, label]) => ({
                                    value,
                                    label: t(label),
                                  }))}
                                />
                              </Form.Item>
                              <Form.Item
                                name={[field.name, 'endDay']}
                                label={t('End weekday')}
                                dependencies={[[field.name, 'startDay']]}
                                rules={[
                                  { required: true },
                                  ({ getFieldValue }) => ({
                                    validator: (_, value) => {
                                      const start = getFieldValue([
                                        'profile',
                                        'serviceHours',
                                        'ranges',
                                        field.name,
                                        'startDay',
                                      ])
                                      const order = weekdayOptions.map(([day]) => day)
                                      return order.indexOf(value) >= order.indexOf(start)
                                        ? Promise.resolve()
                                        : Promise.reject(
                                            new Error(
                                              t(
                                                'The ending weekday must not be before the starting weekday.'
                                              )
                                            )
                                          )
                                    },
                                  }),
                                ]}
                              >
                                <Select
                                  options={weekdayOptions.map(([value, label]) => ({
                                    value,
                                    label: t(label),
                                  }))}
                                />
                              </Form.Item>
                              <Form.Item
                                name={[field.name, 'startTime']}
                                label={t('Start time')}
                                rules={[{ required: true }]}
                              >
                                <Input type="time" />
                              </Form.Item>
                              <Form.Item
                                name={[field.name, 'endTime']}
                                label={t('End time')}
                                dependencies={[[field.name, 'startTime']]}
                                rules={[
                                  { required: true },
                                  ({ getFieldValue }) => ({
                                    validator: (_, value) =>
                                      value !==
                                      getFieldValue([
                                        'profile',
                                        'serviceHours',
                                        'ranges',
                                        field.name,
                                        'startTime',
                                      ])
                                        ? Promise.resolve()
                                        : Promise.reject(
                                            new Error(
                                              t('The start and end times must be different.')
                                            )
                                          ),
                                  }),
                                ]}
                              >
                                <Input type="time" />
                              </Form.Item>
                              <Button
                                danger
                                onClick={() => {
                                  if (fields.length === 1) {
                                    replaceServiceHours(null)
                                    return
                                  }
                                  remove(field.name)
                                }}
                              >
                                {t('Remove service window')}
                              </Button>
                            </Card>
                          ))}
                          <Button onClick={() => add(newServiceRange())}>
                            {t('Add service window')}
                          </Button>
                          </div>
                        )}
                      </Form.List>
                    </>
                  ) : (
                    <Button
                      onClick={() => {
                        replaceServiceHours({
                          kind: 'weekly',
                          ranges: [newServiceRange()],
                        })
                      }}
                    >
                      {t('Add service hours')}
                    </Button>
                  )}
                </div>
                <Form.Item
                  name={['profile', 'timeZone']}
                  label={t('Time zone')}
                  dependencies={[['profile', 'serviceHours']]}
                  rules={[
                    ({ getFieldValue }) => ({
                      validator: (_, value) =>
                        Boolean(value) ===
                        Boolean(getFieldValue(['profile', 'serviceHours']))
                          ? Promise.resolve()
                          : Promise.reject(
                              new Error(
                                t('Service hours and an IANA time zone must be provided together.')
                              )
                            ),
                    }),
                  ]}
                >
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    options={getTimeZoneOptions(settings.profile.timeZone)}
                    placeholder={t('Select a time zone')}
                  />
                </Form.Item>
              </div>
              <Typography.Paragraph type="secondary">
                {t('Service hours and an IANA time zone must be provided together.')}
              </Typography.Paragraph>
            </Card>
            <Card
              title={t('Physical locations')}
              classNames={{ body: FORM_CARD_BODY_WIDTH_CLASS_NAME.compact }}
            >
              <Typography.Paragraph type="secondary">
                {t(
                  'Leave this list empty for an online-only shop. Publish only complete, verified addresses.'
                )}
              </Typography.Paragraph>
              <Form.List name={['profile', 'locations']}>
                {(fields, { add, remove, move }) => (
                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <Card
                        key={field.key}
                        size="small"
                        title={t('Location {number}', { number: index + 1 })}
                      >
                        <Form.Item name={[field.name, 'id']} hidden>
                          <Input />
                        </Form.Item>
                        <div className="grid">
                          <Form.Item
                            name={[field.name, 'name']}
                            label={t('Location name')}
                            rules={[{ required: true }]}
                          >
                            <Input maxLength={120} />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'city']}
                            label={t('City')}
                            rules={[{ required: true }]}
                          >
                            <Input maxLength={120} />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'address']}
                            label={t('Postal address')}
                            rules={[{ required: true }]}
                          >
                            <Input maxLength={500} />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'phone']}
                            label={t('Location phone')}
                            rules={[
                              {
                                pattern: phonePattern,
                                message: t(
                                  'Use an international phone number, such as +12025550123.'
                                ),
                              },
                            ]}
                          >
                            <Input type="tel" />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'email']}
                            label={t('Location email')}
                            rules={[{ type: 'email' }]}
                          >
                            <Input type="email" />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'mapUrl']}
                            label={t('Verified map URL')}
                            rules={[httpsRule(t('Enter an HTTPS URL.'))]}
                          >
                            <Input type="url" />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'visible']}
                            label={t('Publish location')}
                            valuePropName="checked"
                          >
                            <Switch />
                          </Form.Item>
                        </div>
                        <Space wrap>
                          <Button disabled={index === 0} onClick={() => move(index, index - 1)}>
                            {t('Move up')}
                          </Button>
                          <Button
                            disabled={index === fields.length - 1}
                            onClick={() => move(index, index + 1)}
                          >
                            {t('Move down')}
                          </Button>
                          <Button danger onClick={() => remove(field.name)}>
                            {t('Remove location')}
                          </Button>
                        </Space>
                      </Card>
                    ))}
                    <Button onClick={() => add(newLocation())}>{t('Add location')}</Button>
                  </div>
                )}
              </Form.List>
            </Card>
            <Card
              title={t('Social links')}
              classNames={{ body: FORM_CARD_BODY_WIDTH_CLASS_NAME.compact }}
            >
              <Typography.Paragraph type="secondary">
                {t('Only published HTTPS links appear to shoppers, in this order.')}
              </Typography.Paragraph>
              <Form.List name={['profile', 'socials']}>
                {(fields, { add, remove, move }) => (
                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <Card
                        key={field.key}
                        size="small"
                        title={t('Social link {number}', { number: index + 1 })}
                      >
                        <Form.Item name={[field.name, 'id']} hidden>
                          <Input />
                        </Form.Item>
                        <div className="grid">
                          <Form.Item
                            name={[field.name, 'platform']}
                            label={t('Platform')}
                            rules={[
                              { required: true },
                              ({ getFieldValue }) => ({
                                validator: (_, value) => {
                                  const values = getFieldValue(['profile', 'socials']) ?? []
                                  return values.filter(
                                    (social: ContactProfile['socials'][number]) =>
                                      social.platform === value
                                  ).length <= 1
                                    ? Promise.resolve()
                                    : Promise.reject(
                                        new Error(t('Each social platform can only be added once.'))
                                      )
                                },
                              }),
                            ]}
                          >
                            <Select options={socialPlatformOptions} />
                          </Form.Item>
                          <Form.Item name={[field.name, 'label']} hidden>
                            <Input />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'url']}
                            label={t('Destination URL')}
                            rules={[{ required: true }, httpsRule(t('Enter an HTTPS URL.'))]}
                          >
                            <Input type="url" />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'visible']}
                            label={t('Publish social link')}
                            valuePropName="checked"
                          >
                            <Switch />
                          </Form.Item>
                        </div>
                        <Space wrap>
                          <Button disabled={index === 0} onClick={() => move(index, index - 1)}>
                            {t('Move up')}
                          </Button>
                          <Button
                            disabled={index === fields.length - 1}
                            onClick={() => move(index, index + 1)}
                          >
                            {t('Move down')}
                          </Button>
                          <Button danger onClick={() => remove(field.name)}>
                            {t('Remove social link')}
                          </Button>
                        </Space>
                      </Card>
                    ))}
                    <Button
                      disabled={fields.length >= socialPlatformOptions.length}
                      onClick={() => {
                        const used = new Set(socials.map((social) => social.platform))
                        const available = socialPlatformOptions.find(
                          ({ value }) => !used.has(value as SocialPlatform)
                        )?.value as SocialPlatform | undefined
                        if (available) add(newSocial(available))
                      }}
                    >
                      {t('Add social link')}
                    </Button>
                  </div>
                )}
              </Form.List>
            </Card>
            <Card classNames={{ body: FORM_CARD_BODY_WIDTH_CLASS_NAME.compact }}>
              {saveError ? (
                <Alert
                  className="mb-4"
                  type={saveError.status === 409 ? 'warning' : 'error'}
                  showIcon
                  title={t(
                    saveError.status === 409
                      ? 'Contact settings changed since you opened this page.'
                      : 'Contact settings could not be saved.'
                  )}
                  description={t(
                    saveError.status === 409
                      ? 'Your edits are still here. Compare the latest values before replacing this form.'
                      : localizeError(saveError)
                  )}
                  action={
                    saveError.status === 409 ? (
                      <Button loading={comparing} onClick={() => void compareLatest()}>
                        {t('Compare current values')}
                      </Button>
                    ) : undefined
                  }
                />
              ) : null}
              {latest ? (
                <Alert
                  className="mb-4"
                  type="info"
                  showIcon
                  title={t('Current saved contact values')}
                  description={
                    <div className="space-y-1">
                      <p>
                        {t('Support email')}: {latest.supportEmail}
                      </p>
                      <p>
                        {t('Privacy contact email')}: {latest.privacyContactEmail}
                      </p>
                      <p>
                        {t('Public phone')}: {latest.profile.publicPhone || '—'}
                      </p>
                      <p>
                        {t('Service hours')}: {formatServiceHours(latest.profile.serviceHours)}
                      </p>
                      <p>
                        {t('Time zone')}: {latest.profile.timeZone || '—'}
                      </p>
                      {latest.profile.locations.map((location) => (
                        <p key={location.id}>
                          {t('Location name')}: {location.name} — {location.address};{' '}
                          {location.phone || '—'}; {location.email || '—'}; {location.mapUrl || '—'}
                        </p>
                      ))}
                      {latest.profile.socials.map((social) => (
                        <p key={social.id}>
                          {t('Platform')}: {social.platform} — {social.label}: {social.url}
                        </p>
                      ))}
                      <Button onClick={replaceWithLatest}>
                        {t('Replace my edits with current values')}
                      </Button>
                    </div>
                  }
                />
              ) : null}
              {!canWrite ? (
                <Typography.Paragraph type="secondary">
                  {t('You can view these settings but cannot change them.')}
                </Typography.Paragraph>
              ) : null}
            </Card>
            {modeView.showActions ? (
              <FormSubmitToolbar
                submitLabel={t('Save contact settings')}
                submitHtmlType="submit"
                submitLoading={saving}
                submitDisabled={saving || !canWrite}
                resetLabel={t('Reset changes')}
                resetDisabled={saving || !canWrite}
                onReset={() => {
                  setServiceHours(settings.profile.serviceHours)
                  form.setFieldsValue({
                    profile: settings.profile,
                    supportEmail: settings.supportEmail,
                    privacyContactEmail: settings.privacyContactEmail,
                  })
                }}
              />
            ) : null}
          </Form>
        ) : (
          <Alert
            type="error"
            showIcon
            title={t('Contact settings could not be loaded.')}
            action={<Button onClick={() => void load()}>{t('Retry')}</Button>}
          />
        )}
      </TemplateFormStateGate>
    </CustomPageRecipe>
  )
}
