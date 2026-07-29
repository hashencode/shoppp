import { Button, Card, Result, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'

type RouteErrorBoundaryProps = {
  errorCode: string
  detail: string
}

export const RouteErrorBoundary = ({ errorCode, detail }: RouteErrorBoundaryProps) => {
  const navigate = useNavigate()

  return (
    <Card>
      <Result
        status="error"
        title="Template Route Contract Error"
        subTitle={`Code: ${errorCode}`}
        extra={
          <Button type="primary" onClick={() => navigate('/')}>
            Back to home
          </Button>
        }
      />
      <Typography.Paragraph
        className="mx-auto max-w-2xl"
        style={{ color: 'var(--text-secondary)' }}
      >
        {detail}
      </Typography.Paragraph>
    </Card>
  )
}
