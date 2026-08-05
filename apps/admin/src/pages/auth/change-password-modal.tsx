import React, { useState } from 'react'
import { Alert, Form, Input, Modal } from 'antd'
import { changeAdminPassword } from '../../services/auth/api'
import { useI18n } from '../../shared/contexts/i18n-context'

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
  const { t } = useI18n()
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
      setError((failure as Error).message || t('Password change failed.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      destroyOnHidden
      okButtonProps={{ loading: submitting }}
      okText={t('Change password')}
      onCancel={close}
      onOk={() => void submit()}
      open={open}
      title={t('Change password')}
    >
      {error ? <Alert className="mb-4" type="error" showIcon message={error} /> : null}
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          label={t('Current password')}
          name="currentPassword"
          rules={[{ required: true, min: 12, message: t('Enter the current password.') }]}
        >
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          label={t('New password')}
          name="newPassword"
          rules={[{ required: true, min: 12, message: t('The new password must be at least 12 characters.') }]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          dependencies={['newPassword']}
          label={t('Confirm new password')}
          name="confirmPassword"
          rules={[
            { required: true, message: t('Enter the new password again.') },
            ({ getFieldValue }) => ({
              validator(_, value) {
                return value === getFieldValue('newPassword')
                  ? Promise.resolve()
                  : Promise.reject(new Error(t('The passwords do not match.')))
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
