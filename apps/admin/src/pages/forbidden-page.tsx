import { Button, Result } from 'antd'
import React from 'react'
import { useNavigate } from 'react-router-dom'

void React

export const ForbiddenPage = () => {
  const navigate = useNavigate()

  return (
    <Result
      status="403"
      title="Access denied"
      subTitle="Your administrator account does not have permission for this operation."
      extra={
        <Button type="primary" onClick={() => navigate('/catalog/products', { replace: true })}>
          Return to catalog
        </Button>
      }
    />
  )
}
