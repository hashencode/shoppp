import { CloseCircleOutlined, PlusOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Popover,
  Row,
  Select,
  Space,
  Table,
  TimePicker,
  App,
  theme,
} from 'antd'
import type { Dayjs } from 'dayjs'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeaderWithBack } from '../../../shared/components/form-page-header'
import { SortActionGroup } from '../../../shared/components/sort-action-group'

type MemberItem = {
  key: string
  name: string
  workId: string
  department: string
}

type AdvancedValues = {
  name: string
  url: string
  owner: string
  approver: string
  dateRange: [Dayjs, Dayjs]
  type: 'private' | 'public'
  taskName: string
  taskDesc: string
  executor: string
  taskOwner: string
  taskTime: Dayjs
  taskType: 'private' | 'public'
  members: MemberItem[]
}

const fieldLabels: Record<string, string> = {
  name: '仓库名',
  url: '仓库域名',
  owner: '仓库管理员',
  approver: '审批人',
  dateRange: '生效日期',
  type: '仓库类型',
  taskName: '任务名',
  taskDesc: '任务描述',
  executor: '执行人',
  taskOwner: '责任人',
  taskTime: '生效时间',
  taskType: '任务类型',
}

const initialMembers: MemberItem[] = [
  { key: '1', name: 'John Brown', workId: '00001', department: 'New York No. 1 Lake Park' },
  { key: '2', name: 'Jim Green', workId: '00002', department: 'London No. 1 Lake Park' },
  { key: '3', name: 'Joe Black', workId: '00003', department: 'Sydney No. 1 Lake Park' },
]

export const AdvancedFormPage = () => {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [form] = Form.useForm<AdvancedValues>()
  const [errorFields, setErrorFields] = useState<{ name: string; errors: string[] }[]>([])
  const { token } = theme.useToken()

  const errorCount = errorFields.filter((item) => item.errors.length > 0).length
  const errorList = useMemo(
    () =>
      errorFields
        .filter((item) => item.errors.length > 0)
        .map((item) => ({
          ...item,
          label: fieldLabels[item.name] ?? item.name,
        })),
    [errorFields]
  )

  return (
    <Form<AdvancedValues>
      form={form}
      layout="vertical"
      requiredMark={false}
      initialValues={{
        members: initialMembers,
      }}
      onFinish={async (values) => {
        setErrorFields([])
        await new Promise((resolve) => setTimeout(resolve, 700))
        message.success(`提交成功：${values.name}`)
      }}
      onFinishFailed={(errorInfo) => {
        setErrorFields(
          errorInfo.errorFields.map((item) => ({
            name: String(item.name[0]),
            errors: item.errors,
          }))
        )
      }}
    >
      <div className="space-y-4 pb-20">
        <PageHeaderWithBack title="高级表单" onBack={() => navigate('/template/list/table')} />
        <Card title="仓库管理" variant="borderless">
          <Row gutter={16}>
            <Col lg={6} md={12} xs={24}>
              <Form.Item
                label="仓库名"
                name="name"
                rules={[{ required: true, message: '请输入仓库名称' }]}
              >
                <Input placeholder="请输入仓库名称" />
              </Form.Item>
            </Col>
            <Col lg={{ span: 8 }} md={12} xs={24}>
              <Form.Item
                label="仓库域名"
                name="url"
                rules={[{ required: true, message: '请输入仓库域名' }]}
              >
                <Input prefix="http://" suffix=".com" placeholder="请输入" />
              </Form.Item>
            </Col>
            <Col lg={10} md={24} xs={24}>
              <Form.Item
                label="仓库管理员"
                name="owner"
                rules={[{ required: true, message: '请选择管理员' }]}
              >
                <Select
                  placeholder="请选择管理员"
                  options={[
                    { label: '付晓晓', value: 'xiao' },
                    { label: '周毛毛', value: 'mao' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col lg={6} md={12} xs={24}>
              <Form.Item
                label="审批人"
                name="approver"
                rules={[{ required: true, message: '请选择审批员' }]}
              >
                <Select
                  placeholder="请选择审批员"
                  options={[
                    { label: '付晓晓', value: 'xiao' },
                    { label: '周毛毛', value: 'mao' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col lg={8} md={12} xs={24}>
              <Form.Item
                label="生效日期"
                name="dateRange"
                rules={[{ required: true, message: '请选择生效日期' }]}
              >
                <DatePicker.RangePicker className="w-full" />
              </Form.Item>
            </Col>
            <Col lg={10} md={24} xs={24}>
              <Form.Item
                label="仓库类型"
                name="type"
                rules={[{ required: true, message: '请选择仓库类型' }]}
              >
                <Select
                  placeholder="请选择仓库类型"
                  options={[
                    { label: '私密', value: 'private' },
                    { label: '公开', value: 'public' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="任务管理" variant="borderless">
          <Row gutter={16}>
            <Col lg={6} md={12} xs={24}>
              <Form.Item
                label="任务名"
                name="taskName"
                rules={[{ required: true, message: '请输入任务名' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col lg={8} md={12} xs={24}>
              <Form.Item
                label="任务描述"
                name="taskDesc"
                rules={[{ required: true, message: '请输入任务描述' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col lg={10} md={24} xs={24}>
              <Form.Item
                label="执行人"
                name="executor"
                rules={[{ required: true, message: '请选择执行人' }]}
              >
                <Select
                  options={[
                    { label: '付晓晓', value: 'xiao' },
                    { label: '周毛毛', value: 'mao' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col lg={6} md={12} xs={24}>
              <Form.Item
                label="责任人"
                name="taskOwner"
                rules={[{ required: true, message: '请选择责任人' }]}
              >
                <Select
                  options={[
                    { label: '付晓晓', value: 'xiao' },
                    { label: '周毛毛', value: 'mao' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col lg={8} md={12} xs={24}>
              <Form.Item
                label="生效时间"
                name="taskTime"
                rules={[{ required: true, message: '请选择生效时间' }]}
              >
                <TimePicker className="w-full" />
              </Form.Item>
            </Col>
            <Col lg={10} md={24} xs={24}>
              <Form.Item
                label="任务类型"
                name="taskType"
                rules={[{ required: true, message: '请选择任务类型' }]}
              >
                <Select
                  options={[
                    { label: '私密', value: 'private' },
                    { label: '公开', value: 'public' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="成员管理" variant="borderless">
          <Form.List name="members">
            {(fields, { add, remove, move }) => (
              <>
                <Table
                  pagination={false}
                  rowKey="key"
                  dataSource={fields.map((field) => ({ key: field.key, field }))}
                  scroll={{ x: 570 }}
                  columns={[
                    {
                      title: '成员姓名',
                      width: 100,
                      render: (_, row: { field: { name: number } }) => (
                        <Form.Item
                          name={[row.field.name, 'name']}
                          rules={[{ required: true, message: '请输入成员姓名' }]}
                          className="!mb-0"
                        >
                          <Input placeholder="成员姓名" />
                        </Form.Item>
                      ),
                    },
                    {
                      title: '工号',
                      width: 140,
                      render: (_, row: { field: { name: number } }) => (
                        <Form.Item
                          name={[row.field.name, 'workId']}
                          rules={[{ required: true, message: '请输入工号' }]}
                          className="!mb-0"
                        >
                          <Input placeholder="工号" />
                        </Form.Item>
                      ),
                    },
                    {
                      title: '所属部门',
                      width: 120,
                      render: (_, row: { field: { name: number } }) => (
                        <Form.Item
                          name={[row.field.name, 'department']}
                          rules={[{ required: true, message: '请输入部门' }]}
                          className="!mb-0"
                        >
                          <Input placeholder="所属部门" />
                        </Form.Item>
                      ),
                    },
                    {
                      title: '操作',
                      width: 210,
                      render: (_, row: { field: { name: number } }) => (
                        <SortActionGroup
                          index={row.field.name}
                          count={fields.length}
                          onMoveUp={() => move(row.field.name, row.field.name - 1)}
                          onMoveDown={() => move(row.field.name, row.field.name + 1)}
                          onRemove={() => remove(row.field.name)}
                        />
                      ),
                    },
                  ]}
                />

                <Button
                  className="mt-6"
                  icon={<PlusOutlined />}
                  onClick={() =>
                    add({ key: String(Date.now()), name: '', workId: '', department: '' })
                  }
                >
                  添加成员
                </Button>
              </>
            )}
          </Form.List>
        </Card>
      </div>

      <div
        className="fixed right-0 bottom-0 left-0 z-[11] px-6 py-3 backdrop-blur-[6px] lg:left-56 flex justify-center"
        style={{
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgElevated,
        }}
      >
        <Space>
          {errorCount > 0 && (
            <Popover
              trigger="click"
              title="表单校验信息"
              content={
                <ul className="m-0 list-none p-0">
                  {errorList.map((item) => (
                    <li key={item.name} className="mb-2 flex items-center gap-2 text-sm">
                      <CloseCircleOutlined style={{ color: token.colorError }} />
                      <span>{item.errors[0]}</span>
                      <span style={{ color: token.colorTextSecondary }}>{item.label}</span>
                    </li>
                  ))}
                </ul>
              }
            >
              <Button danger icon={<CloseCircleOutlined />}>
                {errorCount}
              </Button>
            </Popover>
          )}
          <Button type="primary" htmlType="submit">
            提交
          </Button>
          <Button htmlType="button" onClick={() => form.resetFields()}>
            重置
          </Button>
        </Space>
      </div>
    </Form>
  )
}
