import React, { useState } from 'react'
import { Alert, Button, Card, Form, Input, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { useAuth } from '../../infrastructure/auth/use-auth'

void React

interface LoginFields {
  email: string
  password: string
}

export const LoginPage = () => {
  const { isLoading, login, sessionError } = useAuth()
  const [submitting, setSubmitting] = useState(false)

  const submit = async (values: LoginFields) => {
    setSubmitting(true)
    try {
      await login(values.email, values.password)
    } catch {
      // The authoritative API message is rendered from the auth context.
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md" title="登录 Shoppp 后台">
        <Typography.Paragraph type="secondary">
          使用你的后台账号和密码登录。
        </Typography.Paragraph>
        {sessionError ? <Alert className="mb-4" type="error" showIcon message={sessionError} /> : null}
        <Form<LoginFields> layout="vertical" onFinish={(values) => void submit(values)}>
          <Form.Item
            label="邮箱"
            name="email"
            rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}
          >
            <Input autoComplete="username" placeholder="name@example.com" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, min: 12, message: '请输入至少 12 位密码' }]}
          >
            <Input.Password autoComplete="current-password" placeholder="请输入密码" />
          </Form.Item>
          <div className="mb-4 text-right">
            <Link to="/forgot-password">忘记密码？</Link>
          </div>
          <Button
            aria-label="登录"
            block
            htmlType="submit"
            loading={submitting || isLoading}
            type="primary"
          >
            登录
          </Button>
        </Form>
      </Card>
    </main>
  )
}
