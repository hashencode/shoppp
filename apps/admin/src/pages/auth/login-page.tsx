import React from 'react'
import {
  LockOutlined,
  MobileOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  Space,
  Tabs,
  Typography,
  message,
  theme,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../infrastructure/auth/use-auth'
void React

type LoginType = 'phone' | 'account'

type LoginValues = {
  username: string
  password: string
  mobile: string
  captcha: string
  remember?: boolean
}

type LoginLocationState = {
  from?: string
}

export const LoginPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const { token } = theme.useToken()
  const [form] = Form.useForm<LoginValues>()
  const [loginType, setLoginType] = useState<LoginType>('account')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [captchaCount, setCaptchaCount] = useState(0)

  const from = ((location.state as LoginLocationState | null)?.from || '/') as string

  useEffect(() => {
    if (captchaCount <= 0) {
      return
    }
    const timer = window.setInterval(() => {
      setCaptchaCount((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [captchaCount])

  const passwordStrength = useMemo(() => {
    const value = form.getFieldValue('password') || ''
    if (!value) return null
    if (value.length > 12) return { label: '强度：强', color: token.colorSuccess }
    if (value.length > 6) return { label: '强度：中', color: token.colorWarning }
    return { label: '强度：弱', color: token.colorError }
  }, [form, token.colorError, token.colorSuccess, token.colorWarning])

  const handleSubmit = async (values: LoginValues) => {
    setSubmitError(null)

    if (loginType === 'account') {
      if (!values.username.trim() || !values.password.trim()) {
        setSubmitError('请输入账号和密码后重试。')
        return
      }
      login({ accountName: values.username.trim(), role: 'admin' })
      navigate(from, { replace: true })
      return
    }

    if (!values.mobile?.trim() || !values.captcha?.trim()) {
      setSubmitError('请输入手机号和验证码后重试。')
      return
    }
    login({ accountName: values.mobile.trim(), role: 'admin' })
    navigate(from, { replace: true })
  }

  const handleGetCaptcha = async () => {
    const mobile = form.getFieldValue('mobile') || ''
    if (!/^1\d{10}$/.test(mobile)) {
      void message.error('请先输入正确手机号')
      return
    }
    setCaptchaCount(59)
    void message.success('获取验证码成功！验证码为：1234')
  }

  return (
    <div
      className="flex min-h-screen justify-center p-6 mt-20"
      style={{
        background: `linear-gradient(135deg, ${token.colorBgLayout}, ${token.colorBgContainer})`,
      }}
    >
      <div className="w-full max-w-[360px]">
        <Space orientation="vertical" size={20} className="w-full">
          <div className="text-center">
            <img
              src="https://raw.githubusercontent.com/brand-icons/brands/refs/heads/master/icons/dark/github.svg"
              alt="logo"
              className="mx-auto mb-3 h-10 w-10"
            />
            <Typography.Title level={3} className="!mb-1">
              Github
            </Typography.Title>
            <Typography.Text type="secondary">全球最大的代码托管平台</Typography.Text>
          </div>

          {submitError ? (
            <Alert
              type="error"
              showIcon
              title="登录失败"
              description={submitError}
              closable={{ onClose: () => setSubmitError(null) }}
            />
          ) : null}

          <Tabs
            centered
            activeKey={loginType}
            onChange={(activeKey) => setLoginType(activeKey as LoginType)}
            items={[
              { key: 'account', label: '账号密码登录' },
              { key: 'phone', label: '手机号登录' },
            ]}
          />
          <Form<LoginValues>
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{ remember: true }}
          >
            {loginType === 'account' ? (
              <>
                <Form.Item name="username" rules={[{ required: true, message: '请输入用户名!' }]}>
                  <Input
                    size="large"
                    prefix={<UserOutlined />}
                    placeholder="用户名"
                    autoComplete="username"
                  />
                </Form.Item>
                <Form.Item name="password" rules={[{ required: true, message: '请输入密码！' }]}>
                  <Input.Password
                    size="large"
                    prefix={<LockOutlined />}
                    placeholder="密码"
                    autoComplete="current-password"
                    onChange={() => form.validateFields(['password']).catch(() => undefined)}
                  />
                </Form.Item>
                {passwordStrength ? (
                  <div className="-mt-3 mb-3 text-sm" style={{ color: passwordStrength.color }}>
                    {passwordStrength.label}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <Form.Item
                  name="mobile"
                  rules={[
                    { required: true, message: '请输入手机号！' },
                    { pattern: /^1\d{10}$/, message: '手机号格式错误！' },
                  ]}
                >
                  <Input size="large" prefix={<MobileOutlined />} placeholder="手机号" />
                </Form.Item>
                <Form.Item name="captcha" rules={[{ required: true, message: '请输入验证码！' }]}>
                  <Input
                    size="large"
                    prefix={<LockOutlined />}
                    placeholder="请输入验证码"
                    suffix={
                      <Button
                        size={'small'}
                        type="link"
                        disabled={captchaCount > 0}
                        onClick={handleGetCaptcha}
                      >
                        {captchaCount > 0 ? `${captchaCount} 获取验证码` : '获取验证码'}
                      </Button>
                    }
                  />
                </Form.Item>
              </>
            )}
            <div className="mb-6">
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox>自动登录</Checkbox>
              </Form.Item>
              <a className="float-right">忘记密码</a>
            </div>
            <Form.Item className="!mb-3">
              <Button type="primary" htmlType="submit" block>
                登 录
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </div>
    </div>
  )
}
