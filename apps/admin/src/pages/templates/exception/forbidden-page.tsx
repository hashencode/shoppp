import { Button, Card, Result } from 'antd'
import { useNavigate } from 'react-router-dom'

export const ForbiddenPage = () => {
  const navigate = useNavigate()

  return (
    <Card variant="borderless">
      <Result
        status="403"
        title="403"
        subTitle="对不起，您没有权限访问此页面。"
        extra={
          <Button type="primary" onClick={() => navigate('/template')}>
            返回首页
          </Button>
        }
      />
    </Card>
  )
}
