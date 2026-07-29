import {
  DatePicker,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Tooltip,
  message,
  theme,
} from 'antd'
import type { RadioChangeEvent } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import React, { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { normalizeApiError, type ApiError } from '../../../infrastructure/http/api-client'
import { useAuth } from '../../../infrastructure/auth/use-auth'
import { LIST_REFRESH_CHANNEL, LIST_REFRESH_EVENT } from '../../../shared/constants/list-refresh-channel'
import { BasicCrudFormRecipe, useTemplateFormController, type BasicCrudFormSpec } from '../../../shared/template-kit/form'
import {
  goBackOrCloseWindow,
  useFormModeAccess,
  useListRefreshChannel,
} from '../../../shared/template-kit/hooks'
import { createForm, fetchFormDetail, type FormEntity, type FormPayload, updateForm } from './api'

const { RangePicker } = DatePicker
void React

type BasicFormValues = {
  title: string
  dateRange: [Dayjs, Dayjs]
  goal: string
  standard: string
  client?: string
  invites?: string
  weight?: number
  publicType: '1' | '2' | '3'
  publicUsers?: string[]
}

const buildDefaultValues = (): Partial<BasicFormValues> => ({
  publicType: '1',
  dateRange: [dayjs().startOf('month'), dayjs().endOf('month')],
})

const toFormValues = (entity: FormEntity): BasicFormValues => ({
  title: entity.title,
  dateRange: [dayjs(entity.dateRangeStart), dayjs(entity.dateRangeEnd)],
  goal: entity.goal,
  standard: entity.standard,
  client: entity.client,
  invites: entity.invites,
  weight: entity.weight,
  publicType: entity.publicType,
  publicUsers: entity.publicUsers,
})

const toFormPayload = (values: BasicFormValues): FormPayload => ({
  title: values.title,
  dateRangeStart: values.dateRange[0].toISOString(),
  dateRangeEnd: values.dateRange[1].toISOString(),
  goal: values.goal,
  standard: values.standard,
  client: values.client,
  invites: values.invites,
  weight: values.weight,
  publicType: values.publicType,
  publicUsers: values.publicUsers,
})

export const BasicFormPage = () => {
  const [form] = Form.useForm<BasicFormValues>()
  const [searchParams] = useSearchParams()
  const { role, permissions } = useAuth()
  const publicType = Form.useWatch('publicType', form) ?? '1'
  const defaultValues = useMemo(() => buildDefaultValues(), [])
  const { token } = theme.useToken()
  const { publishRefresh } = useListRefreshChannel({
    channelName: LIST_REFRESH_CHANNEL,
    eventType: LIST_REFRESH_EVENT.REFRESH_LIST,
  })
  const { parsedMode, modeView, isReadonly, permissionDenied } = useFormModeAccess({
    searchParams,
    role,
    permissions,
  })
  const {
    detailLoading,
    detailError,
    saveLoading,
    initializeForm,
    loadDetail,
    resetFormValues,
    submitFormValues,
  } = useTemplateFormController<BasicFormValues, FormEntity, FormPayload, ApiError>({
    form,
    parsedMode,
    modeView,
    defaultValues,
    fetchDetail: fetchFormDetail,
    createEntity: createForm,
    updateEntity: updateForm,
    toValues: toFormValues,
    toPayload: toFormPayload,
    mapError: normalizeApiError,
  })
  const isAddMode = parsedMode.ok && parsedMode.mode === 'add'

  useEffect(() => {
    void initializeForm()
  }, [initializeForm])

  const spec = useMemo<BasicCrudFormSpec<BasicFormValues>>(
    () => ({
      parsedMode,
      modeView,
      permissionDenied,
      detailLoading,
      detailError,
      saveLoading,
      isReadonly,
      form,
      initialValues: defaultValues,
      title: '基础表单',
      stateCopy: {
        submitBlockedMessage: '查看模式不允许提交。',
        submitSuccessMessage: isAddMode ? '创建成功' : '保存成功',
      },
      onBackToList: () => goBackOrCloseWindow('/template/list/table'),
      onRetryDetail: () => {
        void loadDetail()
      },
      onResetAll: resetFormValues,
      onSubmit: async (values) => {
        if (isReadonly) {
          message.warning('查看模式不允许提交。')
          return
        }

        const submitResult = await submitFormValues(values)
        if (submitResult.success) {
          message.success(isAddMode ? '创建成功' : '保存成功')
          publishRefresh({ source: 'basic-form' })
        } else {
          message.error(submitResult.error.message)
        }
      },
      renderFields: () => (
        <>
          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="给目标起个名字" />
          </Form.Item>

          <Form.Item label="起止日期" name="dateRange" rules={[{ required: true, message: '请选择起止日期' }]}>
            <RangePicker className="w-full" />
          </Form.Item>

          <Form.Item label="目标描述" name="goal" rules={[{ required: true, message: '请输入目标描述' }]}>
            <Input.TextArea rows={4} placeholder="请输入你的阶段性工作目标" />
          </Form.Item>

          <Form.Item label="衡量标准" name="standard" rules={[{ required: true, message: '请输入衡量标准' }]}>
            <Input.TextArea rows={4} placeholder="请输入衡量标准" />
          </Form.Item>

          <Form.Item
            label={
              <span>
                客户 <em className="ml-1 text-xs not-italic" style={{ color: token.colorTextTertiary }}>(选填)</em>
              </span>
            }
            tooltip="目标的服务对象"
            name="client"
          >
            <Input placeholder="请描述你服务的客户，内部客户直接 @姓名/工号" />
          </Form.Item>

          <Form.Item
            label={
              <span>
                邀评人 <em className="ml-1 text-xs not-italic" style={{ color: token.colorTextTertiary }}>(选填)</em>
              </span>
            }
            name="invites"
          >
            <Input placeholder="请直接 @姓名/工号，最多可邀请 5 人" />
          </Form.Item>

          <Form.Item
            label={
              <span>
                权重 <em className="ml-1 text-xs not-italic" style={{ color: token.colorTextTertiary }}>(选填)</em>
              </span>
            }
            name="weight"
          >
            <InputNumber
              min={0 as number}
              max={100 as number}
              className="!w-[120px]"
              formatter={(value) => `${value ?? 0}%`}
              parser={(value) => Number(String(value ?? '0').replace('%', ''))}
            />
          </Form.Item>

          <Form.Item
            label="目标公开"
            name="publicType"
            extra="客户、邀评人默认被分享"
            rules={[{ required: true, message: '请选择目标公开范围' }]}
          >
            <Radio.Group
              options={[
                { value: '1', label: '公开' },
                { value: '2', label: '部分公开' },
                { value: '3', label: '不公开' },
              ]}
              onChange={(event: RadioChangeEvent) => form.setFieldValue('publicType', event.target.value)}
            />
          </Form.Item>

          {publicType === '2' ? (
            <Form.Item
              label={
                <span>
                  公开给
                  <Tooltip title="仅当选择“部分公开”时可设置">
                    <span className="ml-2" style={{ color: token.colorPrimary }}>
                      说明
                    </span>
                  </Tooltip>
                </span>
              }
              name="publicUsers"
              rules={[{ required: true, message: '请选择公开对象' }]}
            >
              <Select
                mode="multiple"
                className="w-full"
                placeholder="请选择同事"
                options={[
                  { value: '同事甲', label: '同事甲' },
                  { value: '同事乙', label: '同事乙' },
                  { value: '同事丙', label: '同事丙' },
                ]}
              />
            </Form.Item>
          ) : null}
        </>
      ),
    }),
    [
      defaultValues,
      detailError,
      detailLoading,
      form,
      isAddMode,
      isReadonly,
      loadDetail,
      modeView,
      parsedMode,
      permissionDenied,
      publicType,
      publishRefresh,
      resetFormValues,
      saveLoading,
      submitFormValues,
      token.colorPrimary,
      token.colorTextTertiary,
    ]
  )

  return <BasicCrudFormRecipe spec={spec} />
}
