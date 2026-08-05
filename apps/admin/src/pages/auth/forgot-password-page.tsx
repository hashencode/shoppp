import React, { useState } from 'react'
import { Alert, Button, Card, Form, Input, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { requestAdminPasswordReset } from '../../services/auth/api'
import { normalizeApiError } from '../../infrastructure/http/api-client'
import { useI18n } from '../../shared/contexts/i18n-context'

void React

export const ForgotPasswordPage = () => {
  const { t } = useI18n()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async ({ email }: { email: string }) => {
    setSubmitting(true)
    setError(null)
    try {
      await requestAdminPasswordReset({ email })
      setSent(true)
    } catch (failure) {
      const candidate = normalizeApiError(failure)
      setError(
        candidate.code === 'protected_admin_password_reset_denied'
          ? t('Protected administrators cannot reset passwords online. Use the controlled recovery process.')
          : candidate.message
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md" title={t('Reset password')}>
        {sent ? (
          <Alert
            type="success"
            showIcon
            message={t('If this standard admin account exists, a reset email has been sent.')}
          />
        ) : (
          <>
            <Typography.Paragraph type="secondary">
              {t('Standard admin users can request a one-time reset link by email.')}
            </Typography.Paragraph>
            {error ? <Alert className="mb-4" type="error" showIcon message={error} /> : null}
            <Form layout="vertical" onFinish={(values) => void submit(values as { email: string })}>
              <Form.Item
                label={t('Email')}
                name="email"
                rules={[{ required: true, type: 'email', message: t('Enter a valid email address.') }]}
              >
                <Input autoComplete="username" />
              </Form.Item>
              <Button block htmlType="submit" loading={submitting} type="primary">
                {t('Send reset email')}
              </Button>
            </Form>
          </>
        )}
        <div className="mt-4 text-center"><Link to="/login">{t('Back to sign in')}</Link></div>
      </Card>
    </main>
  )
}
