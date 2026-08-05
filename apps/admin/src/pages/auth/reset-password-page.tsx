import React, { useState } from 'react'
import { Alert, Button, Card, Form, Input } from 'antd'
import { Link, useSearchParams } from 'react-router-dom'
import { confirmAdminPasswordReset } from '../../services/auth/api'

void React

interface ResetFields {
  confirmPassword: string
  newPassword: string
}

export const ResetPasswordPage = () => {
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
      setError((failure as Error).message || '重置链接无效或已过期。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md" title="设置新密码">
        {!token ? <Alert type="error" showIcon message="重置链接无效。" /> : complete ? (
          <Alert type="success" showIcon message="密码已更新，所有旧会话均已退出。" />
        ) : (
          <>
            {error ? <Alert className="mb-4" type="error" showIcon message={error} /> : null}
            <Form<ResetFields> layout="vertical" onFinish={(values) => void submit(values)}>
              <Form.Item
                label="新密码"
                name="newPassword"
                rules={[{ required: true, min: 12, message: '密码至少需要 12 位' }]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Form.Item
                dependencies={['newPassword']}
                label="确认新密码"
                name="confirmPassword"
                rules={[
                  { required: true, message: '请再次输入新密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      return value === getFieldValue('newPassword')
                        ? Promise.resolve()
                        : Promise.reject(new Error('两次输入的密码不一致'))
                    },
                  }),
                ]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Button block htmlType="submit" loading={submitting} type="primary">更新密码</Button>
            </Form>
          </>
        )}
        <div className="mt-4 text-center"><Link to="/login">返回登录</Link></div>
      </Card>
    </main>
  )
}
