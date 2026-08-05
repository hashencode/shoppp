import React, { useState } from 'react'
import { Alert, Button, Card, Form, Input } from 'antd'
import { Link, useSearchParams } from 'react-router-dom'
import { confirmAdminPasswordReset } from '../../services/auth/api'
import { useI18n } from '../../shared/contexts/i18n-context'

void React

interface ResetFields {
  confirmPassword: string
  newPassword: string
}

export const ResetPasswordPage = () => {
  const { t } = useI18n()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async ({ newPassword }: ResetFields) => {
    setSubmitting(true)
    setError(null)
    try {
      await confirmAdminPasswordReset({ newPassword, token })
      setComplete(true)
    } catch (failure) {
      setError((failure as Error).message || t('The reset link is invalid or expired.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md" title={t('Set a new password')}>
        {!token ? <Alert type="error" showIcon message={t('The reset link is invalid.')} /> : complete ? (
          <Alert type="success" showIcon message={t('Password updated. All previous sessions have been signed out.')} />
        ) : (
          <>
            {error ? <Alert className="mb-4" type="error" showIcon message={error} /> : null}
            <Form<ResetFields> layout="vertical" onFinish={(values) => void submit(values)}>
              <Form.Item
                label={t('New password')}
                name="newPassword"
                rules={[{ required: true, min: 12, message: t('Enter at least 12 characters.') }]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Form.Item
                dependencies={['newPassword']}
                label={t('Confirm new password')}
                name="confirmPassword"
                rules={[
                  { required: true, message: t('Enter the new password again.') },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      return value === getFieldValue('newPassword')
                        ? Promise.resolve()
                        : Promise.reject(new Error(t('The passwords do not match.')))
                    },
                  }),
                ]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Button block htmlType="submit" loading={submitting} type="primary">{t('Update password')}</Button>
            </Form>
          </>
        )}
        <div className="mt-4 text-center"><Link to="/login">{t('Back to sign in')}</Link></div>
      </Card>
    </main>
  )
}
