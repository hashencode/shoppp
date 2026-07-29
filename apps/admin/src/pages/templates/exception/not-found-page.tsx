import { Button, Card, Result } from 'antd'
import { useNavigate } from 'react-router-dom'

export const NotFoundPage = () => {
  const navigate = useNavigate()

  return (
    <Card variant="borderless">
      <Result
        status="404"
        title="404"
        subTitle="对不起，您访问的页面不存在。"
        extra={
          <Button type="primary" onClick={() => navigate('/template')}>
            返回首页
          </Button>
        }
      />
    </Card>
  )
}
