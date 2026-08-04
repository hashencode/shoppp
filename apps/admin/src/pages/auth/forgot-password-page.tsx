import React, { useState } from 'react'
import { Alert, Button, Card, Form, Input, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { requestAdminPasswordReset } from '../../services/auth/api'
import { normalizeApiError } from '../../infrastructure/http/api-client'

void React

export const ForgotPasswordPage = () => {
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
          ? '受保护管理员不支持在线重置密码，请通过受控运维流程恢复。'
          : candidate.message
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md" title="重置密码">
        {sent ? (
          <Alert
            type="success"
            showIcon
            message="如果该普通后台账号存在，重置邮件已经发送。"
          />
        ) : (
          <>
            <Typography.Paragraph type="secondary">
              普通后台用户可以通过邮箱获取一次性重置链接。
            </Typography.Paragraph>
            {error ? <Alert className="mb-4" type="error" showIcon message={error} /> : null}
            <Form layout="vertical" onFinish={(values) => void submit(values as { email: string })}>
              <Form.Item
                label="邮箱"
                name="email"
                rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}
              >
                <Input autoComplete="username" />
              </Form.Item>
              <Button block htmlType="submit" loading={submitting} type="primary">
                发送重置邮件
              </Button>
            </Form>
          </>
        )}
        <div className="mt-4 text-center"><Link to="/login">返回登录</Link></div>
      </Card>
    </main>
  )
}
