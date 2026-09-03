import {
  Alert,
  Button,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
  Result,
  Select,
  Statistic,
  theme,
} from 'antd'
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  isFormValidationError,
  StepFormRecipe,
  type StepFormSpec,
  validateFieldsWithScroll,
} from '../../../shared/template-kit/form'
import {
  stepFormInitialValues,
  stepFormPayAccountOptions,
} from '../../../infrastructure/msw/handlers/form'

void React

type StepValues = {
  payAccount: string
  receiverMode: 'alipay' | 'bank'
  receiverAccount: string
  receiverName: string
  amount: number
  password?: string
}

const StepDescriptions = ({
  values,
  bordered = false,
}: {
  values: StepValues
  bordered?: boolean
}) => {
  return (
    <Descriptions column={1} bordered={bordered} size="small">
      <Descriptions.Item label="付款账户">{values.payAccount}</Descriptions.Item>
      <Descriptions.Item label="收款账户">{values.receiverAccount}</Descriptions.Item>
      <Descriptions.Item label="收款人姓名">{values.receiverName}</Descriptions.Item>
      <Descriptions.Item label="转账金额">
        <Statistic
          value={values.amount}
          precision={2}
          suffix={<span className="text-sm">元</span>}
        />
      </Descriptions.Item>
    </Descriptions>
  )
}

export const StepFormPage = () => {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const [form] = Form.useForm<StepValues>()
  const [current, setCurrent] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [stepData, setStepData] = useState<StepValues>(stepFormInitialValues)

  const goNext = async () => {
    if (current === 0) {
      const values = await validateFieldsWithScroll(form, [
        'payAccount',
        'receiverMode',
        'receiverAccount',
        'receiverName',
        'amount',
      ])
      setStepData((prev) => ({ ...prev, ...values }))
      setCurrent(1)
      return
    }

    if (current === 1) {
      await validateFieldsWithScroll(form, ['password'])
      setCurrent(2)
    }
  }

  const spec: StepFormSpec<StepValues> = {
    title: '分步表单',
    form,
    initialValues: stepData,
    currentStep: current,
    steps: [{ title: '填写转账信息' }, { title: '确认转账信息' }, { title: '完成' }],
    submitting,
    primaryActionLabel: current === 1 ? '提交' : '下一步',
    showStepActions: current < 2,
    onBackToList: () => navigate('/template/list/table'),
    onPrevStep: () => setCurrent((value) => value - 1),
    onPrimaryAction: async () => {
      setSubmitting(true)
      try {
        await goNext()
      } catch (error) {
        if (!isFormValidationError(error)) {
          throw error
        }
      } finally {
        setSubmitting(false)
      }
    },
    renderStepContent: () => {
      if (current === 0) {
        return (
          <>
            <Form.Item
              label="付款账户"
              name="payAccount"
              rules={[{ required: true, message: '请选择付款账户' }]}
            >
              <Select className="md:!w-[320px]" options={stepFormPayAccountOptions} />
            </Form.Item>

            <Form.Item label="收款账户" required className="!mb-2">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr]">
                <Form.Item
                  name="receiverMode"
                  noStyle
                  rules={[{ required: true, message: '请选择账户类型' }]}
                >
                  <Select
                    options={[
                      { value: 'alipay', label: '支付宝' },
                      { value: 'bank', label: '银行账户' },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name="receiverAccount"
                  noStyle
                  rules={[
                    { required: true, message: '请输入收款账户' },
                    { type: 'email', message: '账户名应为邮箱格式' },
                  ]}
                >
                  <Input placeholder="test@example.com" />
                </Form.Item>
              </div>
            </Form.Item>

            <Form.Item
              label="收款人姓名"
              name="receiverName"
              rules={[{ required: true, message: '请输入收款人姓名' }]}
            >
              <Input className="md:!w-[320px]" placeholder="请输入收款人姓名" />
            </Form.Item>

            <Form.Item
              label="转账金额"
              name="amount"
              rules={[
                { required: true, message: '请输入转账金额' },
                { type: 'number', min: 0.01, message: '金额必须大于 0' },
              ]}
            >
              <InputNumber
                className="md:!w-[320px]"
                min={0.01}
                precision={2}
                prefix="￥"
                placeholder="请输入金额"
              />
            </Form.Item>
          </>
        )
      }

      if (current === 1) {
        return (
          <div className="space-y-4">
            <Alert
              showIcon
              closable
              type="warning"
              title="确认转账后，资金将直接打入对方账户，无法退回。"
            />
            <StepDescriptions values={stepData} bordered />
            <Divider className="!my-6" />
            <Form.Item
              label="支付密码"
              name="password"
              rules={[{ required: true, message: '需要支付密码才能进行支付' }]}
            >
              <Input.Password className="md:!w-[320px]" placeholder="请输入支付密码" />
            </Form.Item>
          </div>
        )
      }

      return (
        <Result
          status="success"
          title="操作成功"
          subTitle="预计两小时内到账"
          extra={[
            <Button
              type="primary"
              key="again"
              onClick={() => {
                form.resetFields()
                setCurrent(0)
              }}
            >
              再转一笔
            </Button>,
            <Button key="bill">查看账单</Button>,
          ]}
        >
          <StepDescriptions values={stepData} />
        </Result>
      )
    },
    renderBottomNotes: (
      <>
        <Divider className="!my-8" />
        <div className="space-y-2" style={{ color: token.colorTextSecondary }}>
          <p className="!mb-1 text-base font-medium" style={{ color: token.colorTextHeading }}>
            说明
          </p>
          <p>转账到支付宝账户时，收款账户请使用实名认证邮箱。</p>
          <p>转账到银行卡时，请确认开户姓名和银行账户信息完全一致。</p>
        </div>
      </>
    ),
  }

  return <StepFormRecipe spec={spec} />
}
