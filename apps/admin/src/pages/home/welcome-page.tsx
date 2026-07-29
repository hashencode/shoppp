import { Card, Typography } from 'antd'

export const WelcomePage = () => {
  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-3">
        <Typography.Title className="mb-0 !text-2xl">欢迎使用 Admin Quick Start</Typography.Title>
      </div>
      <Typography.Paragraph>
        对齐 Ant Design Pro 的信息架构与布局体验，但不依赖 ProComponents。用于快速创建统一的后台页面结构、权限布局与业务模板。
      </Typography.Paragraph>
    </Card>
  )
}
