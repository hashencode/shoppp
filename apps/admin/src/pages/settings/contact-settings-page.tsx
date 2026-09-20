import type { ContactProfile, ContactSettings } from '@shoppp/contracts'
import { Alert, App, Button, Card, Form, Input, Space, Switch, Typography } from 'antd'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError, type ApiError } from '../../infrastructure/http/api-client'
import { fetchContactSettings, updateContactSettings } from '../../services/platform/api'
import { useCurrentTranslate, useI18n } from '../../shared/contexts/i18n-context'
import { useLocalizedApiError } from '../../shared/i18n/api-error'
import { CustomPageRecipe } from '../../shared/template-kit/recipes/custom-page-recipe'

void React

type FormValues = {
  supportEmail: string
  privacyContactEmail: string
  profile: ContactProfile
  reason: string
}

const optional = (value: string | null | undefined) => value?.trim() || null
const phonePattern = /^\+[1-9]\d{1,14}$/
const httpsRule = (message: string) => ({ validator: (_: unknown, value: string | null | undefined) => {
  if (!value) return Promise.resolve()
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' && !url.username && !url.password) return Promise.resolve()
  } catch { /* The validation message below covers malformed URLs. */ }
  return Promise.reject(new Error(message))
} })
const timeZoneRule = (message: string) => ({ validator: (_: unknown, value: string | null | undefined) => {
  if (!value) return Promise.resolve()
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return Promise.resolve()
  } catch { return Promise.reject(new Error(message)) }
} })
const newLocation = (): ContactProfile['locations'][number] => ({
  id: crypto.randomUUID(), name: '', city: '', address: '', phone: null,
  email: null, mapUrl: null, visible: false,
})
const newSocial = (): ContactProfile['socials'][number] => ({
  id: crypto.randomUUID(), platform: '', label: '', url: '', visible: false,
})

export const ContactSettingsPage = () => {
  const { message } = App.useApp()
  const { t } = useI18n()
  const translateNow = useCurrentTranslate()
  const localizeError = useLocalizedApiError()
  const { role, permissions } = useAuth()
  const canRead = hasPermission(role, 'settings.read', permissions)
  const canWrite = hasPermission(role, 'settings.write', permissions)
  const [form] = Form.useForm<FormValues>()
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
      setSaveError(null)
      setLatest(null)
      form.setFieldsValue({
        profile: result.profile,
        supportEmail: result.supportEmail,
        privacyContactEmail: result.privacyContactEmail,
        reason: '',
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
    form.setFieldsValue({ profile: latest.profile, supportEmail: latest.supportEmail,
      privacyContactEmail: latest.privacyContactEmail, reason: '' })
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
      serviceHours: optional(values.profile.serviceHours),
      timeZone: optional(values.profile.timeZone),
      locations: (values.profile.locations ?? []).map((location) => ({
        ...location,
        phone: optional(location.phone),
        email: optional(location.email),
        mapUrl: optional(location.mapUrl),
      })),
      socials: values.profile.socials ?? [],
    }
    try {
      const updated = await updateContactSettings({
        profile,
        supportEmail: values.supportEmail,
        privacyContactEmail: values.privacyContactEmail,
        expectedLaunchVersion: settings.launchVersion,
        expectedProfileVersion: settings.profileVersion,
        reason: values.reason,
      })
      setSettings(updated)
      setLatest(null)
      form.setFieldsValue({
        profile: updated.profile,
        supportEmail: updated.supportEmail,
        privacyContactEmail: updated.privacyContactEmail,
        reason: '',
      })
      void message.success(translateNow('Contact settings saved and audited.'))
    } catch (error) {
      setSaveError(normalizeApiError(error))
    } finally {
      setSaving(false)
    }
  }

  if (!canRead) return <Alert type="warning" showIcon title={t('No permission to view contact settings.')} />
  if (loading) return <Card loading title={t('Contact settings')} />
  if (loadError || !settings) return (
    <Alert type="error" showIcon title={t('Contact settings could not be loaded.')}
      description={loadError ? localizeError(loadError) : undefined}
      action={<Button onClick={() => void load()}>{t('Retry')}</Button>} />
  )

  return (
    <CustomPageRecipe title={t('Contact settings')} className="mx-auto max-w-5xl">
      <Typography.Paragraph type="secondary">
        {t('Only channels you explicitly publish will appear on the storefront after a new preview or release.')}
      </Typography.Paragraph>
      <Form<FormValues> form={form} layout="vertical" onFinish={(values) => void save(values)}
        onFinishFailed={({ errorFields }) => {
          const firstInvalid = errorFields[0]?.name
          if (firstInvalid) form.scrollToField(firstInvalid, { focus: true })
        }}
        disabled={!canWrite}>
        <Card title={t('Global contact channels')} className="mb-4">
          <div className="grid gap-x-5 md:grid-cols-2">
            <Form.Item name="supportEmail" label={t('Support email')} rules={[{ required: true, type: 'email' }]}>
              <Input type="email" />
            </Form.Item>
            <Form.Item name="privacyContactEmail" label={t('Privacy contact email')} rules={[{ required: true, type: 'email' }]}>
              <Input type="email" />
            </Form.Item>
            <Form.Item name={['profile', 'publishSupportEmail']} label={t('Show support email publicly')} valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name={['profile', 'publishPrivacyEmail']} label={t('Show privacy email publicly')} valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name={['profile', 'publicPhone']} label={t('Public phone')} rules={[{ pattern: phonePattern, message: t('Use an international phone number, such as +12025550123.') }]}>
              <Input type="tel" placeholder="+12025550123" />
            </Form.Item>
            <div />
            <Form.Item name={['profile', 'serviceHours']} label={t('Service hours')}
              dependencies={[["profile", "timeZone"]]}
              rules={[({ getFieldValue }) => ({ validator: (_, value) =>
                Boolean(optional(value)) === Boolean(optional(getFieldValue(['profile', 'timeZone'])))
                  ? Promise.resolve() : Promise.reject(new Error(t('Service hours and an IANA time zone must be provided together.')))
              })]}>
              <Input maxLength={240} placeholder={t('For example: Monday–Friday, 09:00–18:00')} />
            </Form.Item>
            <Form.Item name={['profile', 'timeZone']} label={t('Time zone')}
              dependencies={[["profile", "serviceHours"]]}
              rules={[timeZoneRule(t('Enter a valid IANA time zone.')), ({ getFieldValue }) => ({ validator: (_, value) =>
                Boolean(optional(value)) === Boolean(optional(getFieldValue(['profile', 'serviceHours'])))
                  ? Promise.resolve() : Promise.reject(new Error(t('Service hours and an IANA time zone must be provided together.')))
              })]}>
              <Input maxLength={100} placeholder="Asia/Shanghai" />
            </Form.Item>
          </div>
          <Typography.Paragraph type="secondary">
            {t('Service hours and an IANA time zone must be provided together.')}
          </Typography.Paragraph>
        </Card>
        <Card title={t('Physical locations')} className="mb-4">
          <Typography.Paragraph type="secondary">{t('Leave this list empty for an online-only shop. Publish only complete, verified addresses.')}</Typography.Paragraph>
          <Form.List name={['profile', 'locations']}>
            {(fields, { add, remove, move }) => (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <Card key={field.key} size="small" title={t('Location {number}', { number: index + 1 })}>
                    <Form.Item name={[field.name, 'id']} hidden><Input /></Form.Item>
                    <div className="grid gap-x-5 md:grid-cols-2">
                      <Form.Item name={[field.name, 'name']} label={t('Location name')} rules={[{ required: true }]}><Input maxLength={120} /></Form.Item>
                      <Form.Item name={[field.name, 'city']} label={t('City')} rules={[{ required: true }]}><Input maxLength={120} /></Form.Item>
                      <Form.Item name={[field.name, 'address']} label={t('Postal address')} rules={[{ required: true }]}><Input maxLength={500} /></Form.Item>
                      <Form.Item name={[field.name, 'phone']} label={t('Location phone')} rules={[{ pattern: phonePattern, message: t('Use an international phone number, such as +12025550123.') }]}><Input type="tel" /></Form.Item>
                      <Form.Item name={[field.name, 'email']} label={t('Location email')} rules={[{ type: 'email' }]}><Input type="email" /></Form.Item>
                      <Form.Item name={[field.name, 'mapUrl']} label={t('Verified map URL')} rules={[httpsRule(t('Enter an HTTPS URL.'))]}><Input type="url" /></Form.Item>
                      <Form.Item name={[field.name, 'visible']} label={t('Publish location')} valuePropName="checked"><Switch /></Form.Item>
                    </div>
                    <Space wrap>
                      <Button disabled={index === 0} onClick={() => move(index, index - 1)}>{t('Move up')}</Button>
                      <Button disabled={index === fields.length - 1} onClick={() => move(index, index + 1)}>{t('Move down')}</Button>
                      <Button danger onClick={() => remove(field.name)}>{t('Remove location')}</Button>
                    </Space>
                  </Card>
                ))}
                <Button onClick={() => add(newLocation())}>{t('Add location')}</Button>
              </div>
            )}
          </Form.List>
        </Card>
        <Card title={t('Social links')} className="mb-4">
          <Typography.Paragraph type="secondary">{t('Only published HTTPS links appear to shoppers, in this order.')}</Typography.Paragraph>
          <Form.List name={['profile', 'socials']}>
            {(fields, { add, remove, move }) => (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <Card key={field.key} size="small" title={t('Social link {number}', { number: index + 1 })}>
                    <Form.Item name={[field.name, 'id']} hidden><Input /></Form.Item>
                    <div className="grid gap-x-5 md:grid-cols-2">
                      <Form.Item name={[field.name, 'platform']} label={t('Platform')} rules={[{ required: true }]}><Input maxLength={60} placeholder="Instagram" /></Form.Item>
                      <Form.Item name={[field.name, 'label']} label={t('Link label')} rules={[{ required: true }]}><Input maxLength={120} /></Form.Item>
                      <Form.Item name={[field.name, 'url']} label={t('Destination URL')} rules={[{ required: true }, httpsRule(t('Enter an HTTPS URL.'))]}><Input type="url" /></Form.Item>
                      <Form.Item name={[field.name, 'visible']} label={t('Publish social link')} valuePropName="checked"><Switch /></Form.Item>
                    </div>
                    <Space wrap>
                      <Button disabled={index === 0} onClick={() => move(index, index - 1)}>{t('Move up')}</Button>
                      <Button disabled={index === fields.length - 1} onClick={() => move(index, index + 1)}>{t('Move down')}</Button>
                      <Button danger onClick={() => remove(field.name)}>{t('Remove social link')}</Button>
                    </Space>
                  </Card>
                ))}
                <Button onClick={() => add(newSocial())}>{t('Add social link')}</Button>
              </div>
            )}
          </Form.List>
        </Card>
        <Card>
          <Form.Item name="reason" label={t('Change reason')} rules={[{ required: true, min: 3, max: 500 }]}>
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
          {saveError ? (
            <Alert className="mb-4" type={saveError.status === 409 ? 'warning' : 'error'} showIcon
              title={t(saveError.status === 409 ? 'Contact settings changed since you opened this page.' : 'Contact settings could not be saved.')}
              description={t(saveError.status === 409
                ? 'Your edits are still here. Compare the latest values before replacing this form.'
                : localizeError(saveError))}
              action={saveError.status === 409 ? <Button loading={comparing} onClick={() => void compareLatest()}>{t('Compare current values')}</Button> : undefined} />
          ) : null}
          {latest ? <Alert className="mb-4" type="info" showIcon
            title={t('Current saved contact values')}
            description={<div className="space-y-1">
              <p>{t('Support email')}: {latest.supportEmail}</p>
              <p>{t('Privacy contact email')}: {latest.privacyContactEmail}</p>
              <p>{t('Public phone')}: {latest.profile.publicPhone || '—'}</p>
              <p>{t('Service hours')}: {latest.profile.serviceHours || '—'}</p>
              <p>{t('Time zone')}: {latest.profile.timeZone || '—'}</p>
              {latest.profile.locations.map((location) => <p key={location.id}>
                {t('Location name')}: {location.name} — {location.address}; {location.phone || '—'}; {location.email || '—'}; {location.mapUrl || '—'}
              </p>)}
              {latest.profile.socials.map((social) => <p key={social.id}>
                {t('Platform')}: {social.platform} — {social.label}: {social.url}
              </p>)}
              <Button onClick={replaceWithLatest}>{t('Replace my edits with current values')}</Button>
            </div>} /> : null}
          <Space wrap>
            {canWrite ? <Button type="primary" htmlType="submit" loading={saving}>{t('Save contact settings')}</Button> : null}
            {canWrite ? <Button onClick={() => form.setFieldsValue({ profile: settings.profile, supportEmail: settings.supportEmail, privacyContactEmail: settings.privacyContactEmail, reason: '' })}>{t('Reset changes')}</Button> : null}
          </Space>
          {!canWrite ? <Typography.Paragraph type="secondary">{t('You can view these settings but cannot change them.')}</Typography.Paragraph> : null}
        </Card>
      </Form>
    </CustomPageRecipe>
  )
}
