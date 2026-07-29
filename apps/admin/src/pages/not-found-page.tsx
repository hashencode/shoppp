import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'

export const NotFoundPage = () => {
  const navigate = useNavigate()

  return (
    <Result
      status="404"
      title="Page not found"
      subTitle="This operations route does not exist or is no longer available."
      extra={
        <Button type="primary" onClick={() => navigate('/dashboard')}>
          Return to dashboard
        </Button>
      }
    />
  )
}
