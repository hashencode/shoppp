import React, { useRef, useState } from 'react'
import { Alert, Button, Card, Form, Input } from 'antd'
import { Link } from 'react-router-dom'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { useI18n } from '../../shared/contexts/i18n-context'

void React

interface LoginFields {
  email: string
  password: string
}

export const LoginPage = () => {
  const { isLoading, login, sessionError } = useAuth()
  const { t } = useI18n()
  const [submitting, setSubmitting] = useState(false)
  const submitLock = useRef(false)

  const submit = async (values: LoginFields) => {
    if (submitLock.current) return
    submitLock.current = true
    setSubmitting(true)
    try {
      await login(values.email, values.password)
    } catch {
      // The authoritative API message is rendered from the auth context.
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md" title={t('Sign in to Shoppp Admin')}>
        {sessionError ? <Alert className="mb-4" type="error" showIcon message={sessionError} /> : null}
        <Form<LoginFields> layout="vertical" disabled={submitting} onFinish={(values) => void submit(values)}>
          <Form.Item
            label={t('Email')}
            name="email"
            rules={[{ required: true, type: 'email', message: t('Enter a valid email address.') }]}
          >
            <Input autoComplete="username" placeholder="name@example.com" />
          </Form.Item>
          <Form.Item
            label={t('Password')}
            name="password"
            rules={[{ required: true, min: 12, message: t('Enter at least 12 characters.') }]}
          >
            <Input.Password autoComplete="current-password" placeholder={t('Enter password')} />
          </Form.Item>
          <div className="mb-4 text-right">
            <Link to="/forgot-password">{t('Forgot password?')}</Link>
          </div>
          <Button
            aria-label={t('Sign in')}
            block
            htmlType="submit"
            loading={submitting || isLoading}
            type="primary"
          >
            {t('Sign in')}
          </Button>
        </Form>
      </Card>
    </main>
  )
}
