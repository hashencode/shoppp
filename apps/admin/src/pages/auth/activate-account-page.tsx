import React, { useState } from 'react'
import { Alert, Button, Card, Form, Input } from 'antd'
import { Link, useSearchParams } from 'react-router-dom'
import { activateAdminAccount } from '../../services/auth/api'
import { useAuth } from '../../infrastructure/auth/use-auth'

void React

interface ActivationFields {
  confirmPassword: string
  password: string
}

export const ActivateAccountPage = () => {
  const { refreshSession } = useAuth()
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
      setError((failure as Error).message || '激活链接无效或已过期。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md" title="激活后台账号">
        {!token ? <Alert type="error" showIcon message="激活链接无效。" /> : complete ? (
          <Alert type="success" showIcon message="账号已激活，现在可以登录。" />
        ) : (
          <>
            {error ? <Alert className="mb-4" type="error" showIcon message={error} /> : null}
            <Form<ActivationFields> layout="vertical" onFinish={(values) => void submit(values)}>
              <Form.Item
                label="设置密码"
                name="password"
                rules={[{ required: true, min: 12, message: '密码至少需要 12 位' }]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Form.Item
                dependencies={['password']}
                label="确认密码"
                name="confirmPassword"
                rules={[
                  { required: true, message: '请再次输入密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      return value === getFieldValue('password')
                        ? Promise.resolve()
                        : Promise.reject(new Error('两次输入的密码不一致'))
                    },
                  }),
                ]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Button block htmlType="submit" loading={submitting} type="primary">激活账号</Button>
            </Form>
          </>
        )}
        <div className="mt-4 text-center"><Link to="/login">返回登录</Link></div>
      </Card>
    </main>
  )
}
