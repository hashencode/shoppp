import React, { useState } from 'react'
import { Alert, Button, Card, Form, Input } from 'antd'
import { Link, useSearchParams } from 'react-router-dom'
import { activateAdminAccount } from '../../services/auth/api'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { useI18n } from '../../shared/contexts/i18n-context'

void React

interface ActivationFields {
  confirmPassword: string
  password: string
}

export const ActivateAccountPage = () => {
  const { refreshSession } = useAuth()
  const { t } = useI18n()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async ({ password }: ActivationFields) => {
    setSubmitting(true)
    setError(null)
    try {
      await activateAdminAccount({ password, token })
      setComplete(true)
      await refreshSession()
    } catch (failure) {
      setError((failure as Error).message || t('The activation link is invalid or expired.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md" title={t('Activate admin account')}>
        {!token ? <Alert type="error" showIcon message={t('The activation link is invalid.')} /> : complete ? (
          <Alert type="success" showIcon message={t('Account activated. You can now sign in.')} />
        ) : (
          <>
            {error ? <Alert className="mb-4" type="error" showIcon message={error} /> : null}
            <Form<ActivationFields> layout="vertical" onFinish={(values) => void submit(values)}>
              <Form.Item
                label={t('Set password')}
                name="password"
                rules={[{ required: true, min: 12, message: t('Enter at least 12 characters.') }]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Form.Item
                dependencies={['password']}
                label={t('Confirm password')}
                name="confirmPassword"
                rules={[
                  { required: true, message: t('Enter the password again.') },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      return value === getFieldValue('password')
                        ? Promise.resolve()
                        : Promise.reject(new Error(t('The passwords do not match.')))
                    },
                  }),
                ]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Button block htmlType="submit" loading={submitting} type="primary">{t('Activate account')}</Button>
            </Form>
          </>
        )}
        <div className="mt-4 text-center"><Link to="/login">{t('Back to sign in')}</Link></div>
      </Card>
    </main>
  )
}
