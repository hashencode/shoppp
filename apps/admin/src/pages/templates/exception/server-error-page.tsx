import { Button, Card, Result } from 'antd'
import { useNavigate } from 'react-router-dom'

export const ServerErrorPage = () => {
  const navigate = useNavigate()

  return (
    <Card variant="borderless">
      <Result
        status="500"
        title="500"
        subTitle="对不起，出了点问题。"
        extra={
          <Button type="primary" onClick={() => navigate('/template')}>
            返回首页
          </Button>
        }
      />
    </Card>
  )
}
