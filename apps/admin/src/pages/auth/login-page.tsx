import React from 'react'
import { Button, Result } from 'antd'
import { useAuth } from '../../infrastructure/auth/use-auth'

void React

const copy = {
  'access-required': {
    title: 'Cloudflare Access session required',
    subtitle:
      'Open the protected test admin hostname and sign in with the approved identity provider.',
  },
  'invitation-required': {
    title: 'Admin invitation required',
    subtitle: 'This Access identity is not currently authorized. Contact an administrator.',
  },
  'invitation-expired': {
    title: 'Admin invitation expired',
    subtitle: 'Ask an administrator to resend access, then verify the Access session again.',
  },
  disabled: {
    title: 'Admin access disabled',
    subtitle: 'This account cannot use the admin application. Contact an administrator.',
  },
  forbidden: {
    title: 'Admin access forbidden',
    subtitle: 'The current identity does not have a valid admin authorization state.',
  },
} as const

export const LoginPage = () => {
  const { refreshSession, status } = useAuth()
  const state = status === 'loading' || status === 'authenticated' ? copy['access-required'] : copy[status]
  return (
    <Result
      status="403"
      title={state.title}
      subTitle={state.subtitle}
      extra={
        <Button type="primary" onClick={() => void refreshSession()}>
          Verify Access session
        </Button>
      }
    />
  )
}
