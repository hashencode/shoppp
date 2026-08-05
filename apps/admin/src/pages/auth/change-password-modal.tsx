import React, { useState } from 'react'
import { Alert, Form, Input, Modal } from 'antd'
import { changeAdminPassword } from '../../services/auth/api'

void React

interface ChangePasswordModalProps {
  onClose: () => void
  open: boolean
}

interface ChangePasswordFields {
  confirmPassword: string
  currentPassword: string
  newPassword: string
}

export const ChangePasswordModal = ({ onClose, open }: ChangePasswordModalProps) => {
  const [form] = Form.useForm<ChangePasswordFields>()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const close = () => {
    form.resetFields()
    setError(null)
    onClose()
  }

  const submit = async () => {
    const values = await form.validateFields()
    setSubmitting(true)
    setError(null)
    try {
      await changeAdminPassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      close()
    } catch (failure) {
      setError((failure as Error).message || '密码修改失败。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      destroyOnHidden
      okButtonProps={{ loading: submitting }}
      okText="修改密码"
      onCancel={close}
      onOk={() => void submit()}
      open={open}
      title="修改密码"
    >
      {error ? <Alert className="mb-4" type="error" showIcon message={error} /> : null}
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          label="当前密码"
          name="currentPassword"
          rules={[{ required: true, min: 12, message: '请输入当前密码' }]}
        >
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          label="新密码"
          name="newPassword"
          rules={[{ required: true, min: 12, message: '新密码至少需要 12 位' }]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          dependencies={['newPassword']}
          label="确认新密码"
          name="confirmPassword"
          rules={[
            { required: true, message: '请再次输入新密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                return value === getFieldValue('newPassword')
                  ? Promise.resolve()
                  : Promise.reject(new Error('两次输入的密码不一致'))
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
