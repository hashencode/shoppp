import { Button, Card, Descriptions, Result, Steps, theme } from 'antd'
import { Link } from 'react-router-dom'
import { resultSuccessProcessItems, resultSuccessProjectInfo } from '../../../infrastructure/msw/handlers/result'

export const ResultSuccessPage = () => {
  const { token } = theme.useToken()
  const processItems = resultSuccessProcessItems.map((item) => ({
    title: item.title,
    description:
      item.owner || item.time ? (
        <div className="text-xs leading-[1.5]" style={{ color: token.colorTextSecondary }}>
          {item.owner && <div>{item.owner}</div>}
          {item.time && <div>{item.time}</div>}
        </div>
      ) : undefined,
  }))

  return (
    <Card variant="borderless">
      <Result
        status="success"
        title="提交成功"
        subTitle="提交结果页用于反馈一系列操作任务的处理结果，如果只是简单操作，使用 Message 全局提示即可。"
        extra={[
          <Button key="list" type="primary">
            <Link to="/template/list/table">返回列表</Link>
          </Button>,
          <Button key="profile">
            <Link to="/template/profile/basic">查看项目</Link>
          </Button>,
          <Button key="print">打印</Button>,
        ]}
      >
        <Descriptions title="项目名称" className="mb-4">
          <Descriptions.Item label="项目 ID">{resultSuccessProjectInfo.projectId}</Descriptions.Item>
          <Descriptions.Item label="负责人">{resultSuccessProjectInfo.owner}</Descriptions.Item>
          <Descriptions.Item label="生效时间">{resultSuccessProjectInfo.effectiveTime}</Descriptions.Item>
        </Descriptions>

        <Steps type="dot" current={1} items={processItems} />
      </Result>
    </Card>
  )
}
