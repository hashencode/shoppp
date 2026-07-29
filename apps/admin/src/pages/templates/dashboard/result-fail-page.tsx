import { CloseCircleOutlined, RightOutlined } from '@ant-design/icons'
import { Button, Card, Result, theme } from 'antd'
import { Link } from 'react-router-dom'

const ErrorContent = () => {
  const { token } = theme.useToken()

  return (
  <>
    <div className="mb-4">您提交的内容有如下错误：</div>

    <div className="mb-3 flex items-center text-sm">
      <CloseCircleOutlined className="mr-2" style={{ color: token.colorError }} />
      <span>您的账户已被冻结</span>
      <a className="ml-4 inline-flex items-center gap-1">
        立即解冻 <RightOutlined />
      </a>
    </div>

    <div className="mb-3 flex items-center text-sm">
      <CloseCircleOutlined className="mr-2" style={{ color: token.colorError }} />
      <span>您的账户还不具备申请资格</span>
      <a className="ml-4 inline-flex items-center gap-1">
        立即升级 <RightOutlined />
      </a>
    </div>
  </>
)
}

export const ResultFailPage = () => {
  return (
    <Card variant="borderless">
      <Result
        status="error"
        title="提交失败"
        subTitle="请核对并修改以下信息后，再重新提交。"
        extra={[
          <Button key="retry" type="primary">
            <Link to="/template/list/table/form">返回修改</Link>
          </Button>,
        ]}
      >
        <ErrorContent />
      </Result>
    </Card>
  )
}
