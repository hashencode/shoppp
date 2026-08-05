import React, { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  TreeSelect,
} from 'antd'
import type {
  ColProps,
  DatePickerProps,
  FormInstance,
  FormItemProps,
  FormProps,
  InputNumberProps,
  InputProps,
  RowProps,
  SelectProps,
  TreeSelectProps,
} from 'antd'
import {
  RemoteSearchSelect,
  type RemoteSearchSelectOption,
  type RemoteSearchSelectProps,
  type RemoteSearchSelectValue,
} from '../../components/remote-search-select'
import { useI18n } from '../../contexts/i18n-context'

type FilterFieldName<TValues> = Extract<keyof TValues, string>

export type TemplateListFilterOption = {
  label: React.ReactNode
  value: string | number
}

const POPUP_WIDTH_TRIGGER_TEXT_LENGTH = 10
const POPUP_WIDTH_FOR_LONG_OPTION = 300
const COMPACT_INPUT_WIDTH = '220px'

const getOptionLabelTextLength = (label: React.ReactNode): number => {
  if (typeof label === 'string') {
    return label.length
  }

  if (typeof label === 'number') {
    return String(label).length
  }

  return 0
}

export const resolveSelectPopupMatchWidthByOptions = (
  options: TemplateListFilterOption[],
  popupMatchSelectWidth: SelectProps['popupMatchSelectWidth']
): SelectProps['popupMatchSelectWidth'] => {
  if (popupMatchSelectWidth !== undefined) {
    return popupMatchSelectWidth
  }

  const hasLongLabel = options.some(
    (option) => getOptionLabelTextLength(option.label) > POPUP_WIDTH_TRIGGER_TEXT_LENGTH
  )
  return hasLongLabel ? POPUP_WIDTH_FOR_LONG_OPTION : undefined
}

type TemplateListFilterFieldBase<TValues extends Record<string, unknown>> = {
  key?: string
  label?: React.ReactNode
  colProps?: ColProps
  formItemProps?: Omit<FormItemProps<TValues>, 'name' | 'label' | 'children'>
  visibleWhen?: (values: Partial<TValues>) => boolean
  disabledWhen?: (values: Partial<TValues>) => boolean
}

type TemplateListInputField<TValues extends Record<string, unknown>> =
  TemplateListFilterFieldBase<TValues> & {
    type: 'input'
    name: FilterFieldName<TValues>
    inputProps?: InputProps
  }

type TemplateListNumberField<TValues extends Record<string, unknown>> =
  TemplateListFilterFieldBase<TValues> & {
    type: 'number'
    name: FilterFieldName<TValues>
    inputNumberProps?: InputNumberProps
  }

type TemplateListDateField<TValues extends Record<string, unknown>> =
  TemplateListFilterFieldBase<TValues> & {
    type: 'date'
    name: FilterFieldName<TValues>
    datePickerProps?: DatePickerProps
  }

type TemplateListDateRangeField<TValues extends Record<string, unknown>> =
  TemplateListFilterFieldBase<TValues> & {
    type: 'date-range'
    name: FilterFieldName<TValues>
    datePickerProps?: React.ComponentProps<typeof DatePicker.RangePicker>
  }

type TemplateListSelectField<TValues extends Record<string, unknown>> =
  TemplateListFilterFieldBase<TValues> & {
    type: 'select'
    name: FilterFieldName<TValues>
    options?: TemplateListFilterOption[]
    optionsLoader?: (context: {
      values: Partial<TValues>
      signal: AbortSignal
    }) => Promise<TemplateListFilterOption[]>
    dependsOn?: FilterFieldName<TValues>[]
    selectProps?: SelectProps
    onLoadError?: (error: unknown) => void
  }

type TemplateListRemoteSelectField<TValues extends Record<string, unknown>> =
  TemplateListFilterFieldBase<TValues> & {
    type: 'remote-select'
    name: FilterFieldName<TValues>
    defaultOptions?: RemoteSearchSelectOption<unknown, RemoteSearchSelectValue>[]
    fetchOptions: (
      keyword: string,
      current?: number
    ) => Promise<RemoteSearchSelectOption<unknown, RemoteSearchSelectValue>[]>
    remoteSelectProps?: Omit<
      RemoteSearchSelectProps<unknown, RemoteSearchSelectValue>,
      'defaultOptions' | 'fetchOptions'
    >
  }

type TemplateListTreeSelectField<TValues extends Record<string, unknown>> =
  TemplateListFilterFieldBase<TValues> & {
    type: 'tree-select'
    name: FilterFieldName<TValues>
    treeSelectProps?: TreeSelectProps
  }

type TemplateListCustomField<TValues extends Record<string, unknown>> =
  TemplateListFilterFieldBase<TValues> & {
    type: 'custom'
    render: (context: {
      values: Partial<TValues>
      form: FormInstance<TValues>
      labelCol?: ColProps
      wrapperCol?: ColProps
    }) => React.ReactNode
  }

export type TemplateListFilterField<TValues extends Record<string, unknown>> =
  | TemplateListInputField<TValues>
  | TemplateListNumberField<TValues>
  | TemplateListDateField<TValues>
  | TemplateListDateRangeField<TValues>
  | TemplateListSelectField<TValues>
  | TemplateListRemoteSelectField<TValues>
  | TemplateListTreeSelectField<TValues>
  | TemplateListCustomField<TValues>

type TemplateListFilterFormProps<TValues extends Record<string, unknown>> = {
  form: FormInstance<TValues>
  fields: TemplateListFilterField<TValues>[]
  onSubmit: (values: TValues) => void
  onReset: () => void
  onValuesChange?: (values: TValues) => void
  formProps?: Omit<FormProps<TValues>, 'form' | 'onFinish' | 'onValuesChange'>
  rowGutter?: RowProps['gutter']
  fieldColProps: ColProps
  actionsColProps: ColProps
  labelCol?: ColProps
  wrapperCol?: ColProps
  compactLayout?: boolean
  submitText?: string
  resetText?: string
  submitLoading?: boolean
  extraActions?: React.ReactNode
  extraActionsPlacement?: 'after-primary-actions' | 'before-primary-actions'
  extraActionsDivider?: boolean
}

export const DEFAULT_TEMPLATE_LIST_FILTER_ROW_GUTTER: RowProps['gutter'] = [
  { xs: 8, sm: 12, md: 16, lg: 16, xl: 16, xxl: 16 },
  { xs: 8, sm: 10, md: 12, lg: 12, xl: 12, xxl: 12 },
]

const buildFieldContainer = (
  compactLayout: boolean,
  colProps: ColProps,
  content: React.ReactNode
) => {
  if (compactLayout) {
    return <div className="shrink-0">{content}</div>
  }

  return <Col {...colProps}>{content}</Col>
}

const buildFormItemLayout = (
  compactLayout: boolean,
  labelCol?: ColProps,
  wrapperCol?: ColProps
) => {
  if (!compactLayout) {
    return { labelCol, wrapperCol }
  }

  return {
    labelCol: { flex: 'none' },
    wrapperCol: { flex: COMPACT_INPUT_WIDTH },
  }
}

const TemplateListFilterFieldNode = <TValues extends Record<string, unknown>>({
  field,
  form,
  values,
  defaultColProps,
  labelCol,
  wrapperCol,
  compactLayout,
}: {
  field: TemplateListFilterField<TValues>
  form: FormInstance<TValues>
  values: Partial<TValues>
  defaultColProps: ColProps
  labelCol?: ColProps
  wrapperCol?: ColProps
  compactLayout: boolean
}) => {
  const visible = field.visibleWhen ? field.visibleWhen(values) : true

  const colProps = field.colProps ?? defaultColProps
  if (!visible) {
    return null
  }

  if (field.type === 'custom') {
    return buildFieldContainer(
      compactLayout,
      colProps,
      field.render({ values, form, labelCol, wrapperCol })
    )
  }

  const disabled = field.disabledWhen ? field.disabledWhen(values) : false

  if (field.type === 'select') {
    return (
      <TemplateListSelectFilterFieldNode
        field={field}
        values={values}
        disabled={disabled}
        colProps={colProps}
        labelCol={labelCol}
        wrapperCol={wrapperCol}
        compactLayout={compactLayout}
      />
    )
  }

  if (field.type === 'remote-select') {
    const layout = buildFormItemLayout(compactLayout, labelCol, wrapperCol)
    const popupMatchSelectWidth = resolveSelectPopupMatchWidthByOptions(
      field.defaultOptions ?? [],
      field.remoteSelectProps?.popupMatchSelectWidth
    )

    return buildFieldContainer(
      compactLayout,
      colProps,
      <Form.Item<TValues>
        label={field.label}
        name={field.name as never}
        className="!mb-0 !mr-0"
        labelAlign={compactLayout ? 'left' : 'right'}
        {...layout}
        {...field.formItemProps}
      >
        <RemoteSearchSelect<unknown, RemoteSearchSelectValue>
          allowClear
          className="!w-full"
          disabled={disabled}
          defaultOptions={field.defaultOptions}
          fetchOptions={field.fetchOptions}
          popupMatchSelectWidth={popupMatchSelectWidth}
          {...field.remoteSelectProps}
        />
      </Form.Item>
    )
  }

  const layout = buildFormItemLayout(compactLayout, labelCol, wrapperCol)

  return buildFieldContainer(
    compactLayout,
    colProps,
    <Form.Item<TValues>
      label={field.label}
      name={field.name as never}
      className="!mb-0 !mr-0"
      labelAlign={compactLayout ? 'left' : 'right'}
      {...layout}
      {...field.formItemProps}
    >
      {field.type === 'input' ? (
        <Input allowClear className="!w-full" disabled={disabled} {...field.inputProps} />
      ) : field.type === 'number' ? (
        <InputNumber className="!w-full" disabled={disabled} {...field.inputNumberProps} />
      ) : field.type === 'tree-select' ? (
        <TreeSelect allowClear className="!w-full" disabled={disabled} {...field.treeSelectProps} />
      ) : field.type === 'date-range' ? (
        <DatePicker.RangePicker
          allowClear
          className="!w-full"
          disabled={disabled}
          {...field.datePickerProps}
        />
      ) : (
        <DatePicker allowClear className="!w-full" disabled={disabled} {...field.datePickerProps} />
      )}
    </Form.Item>
  )
}

const TemplateListSelectFilterFieldNode = <TValues extends Record<string, unknown>>({
  field,
  values,
  disabled,
  colProps,
  labelCol,
  wrapperCol,
  compactLayout,
}: {
  field: TemplateListSelectField<TValues>
  values: Partial<TValues>
  disabled: boolean
  colProps: ColProps
  labelCol?: ColProps
  wrapperCol?: ColProps
  compactLayout: boolean
}) => {
  const [dynamicOptions, setDynamicOptions] = useState<TemplateListFilterOption[]>([])
  const optionsLoader = field.optionsLoader
  const onLoadError = field.onLoadError
  const selectProps = field.selectProps
  const dependencyValues = useMemo(() => {
    if (!field.dependsOn || field.dependsOn.length === 0) {
      return {} as Partial<TValues>
    }

    return field.dependsOn.reduce<Partial<TValues>>((acc, name) => {
      acc[name] = values[name]
      return acc
    }, {})
  }, [field.dependsOn, values])
  const dependencyKey = useMemo(() => {
    if (!field.dependsOn || field.dependsOn.length === 0) {
      return '__no_dependency__'
    }

    return JSON.stringify(dependencyValues)
  }, [dependencyValues, field.dependsOn])

  useEffect(() => {
    if (!optionsLoader) {
      return
    }

    const controller = new AbortController()
    const requestValues =
      dependencyKey === '__no_dependency__'
        ? ({} as Partial<TValues>)
        : (JSON.parse(dependencyKey) as Partial<TValues>)

    void optionsLoader({ values: requestValues, signal: controller.signal })
      .then((options) => {
        if (controller.signal.aborted) {
          return
        }

        setDynamicOptions(options)
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return
        }

        setDynamicOptions([])
        onLoadError?.(error)
      })

    return () => {
      controller.abort()
    }
  }, [dependencyKey, onLoadError, optionsLoader])

  const options = field.optionsLoader ? dynamicOptions : (field.options ?? [])
  const popupMatchSelectWidth = resolveSelectPopupMatchWidthByOptions(
    options,
    selectProps?.popupMatchSelectWidth
  )
  const mergedSelectProps = useMemo(() => {
    if (selectProps?.filterOption !== false || typeof selectProps.onSearch !== 'function') {
      return selectProps
    }

    return {
      ...selectProps,
      onClear: (...args: Parameters<NonNullable<SelectProps['onClear']>>) => {
        selectProps.onSearch?.('')
        selectProps.onClear?.(...args)
      },
    } satisfies SelectProps
  }, [selectProps])
  const layout = buildFormItemLayout(compactLayout, labelCol, wrapperCol)

  return buildFieldContainer(
    compactLayout,
    colProps,
    <Form.Item<TValues>
      label={field.label}
      name={field.name as never}
      className="!mb-0 !mr-0"
      labelAlign={compactLayout ? 'left' : 'right'}
      {...layout}
      {...field.formItemProps}
    >
      <Select
        allowClear
        className="!w-full"
        disabled={disabled}
        options={options}
        popupMatchSelectWidth={popupMatchSelectWidth}
        {...mergedSelectProps}
      />
    </Form.Item>
  )
}

export const TemplateListFilterForm = <TValues extends Record<string, unknown>>({
  form,
  fields,
  onSubmit,
  onReset,
  onValuesChange,
  formProps,
  rowGutter = DEFAULT_TEMPLATE_LIST_FILTER_ROW_GUTTER,
  fieldColProps,
  actionsColProps,
  labelCol,
  wrapperCol,
  compactLayout = false,
  submitText,
  resetText,
  submitLoading = false,
  extraActions,
  extraActionsPlacement = 'after-primary-actions',
  extraActionsDivider = false,
}: TemplateListFilterFormProps<TValues>) => {
  const { t } = useI18n()
  const resolvedSubmitText = submitText ?? t('Search')
  const resolvedResetText = resetText ?? t('Reset')
  const values =
    (Form.useWatch((currentValues) => currentValues as Partial<TValues>, form) as
      Partial<TValues> | undefined) ?? {}
  const resolvedExtraActions = extraActions ? <div className="shrink-0">{extraActions}</div> : null
  const resolvedPrimaryActions = (
    <>
      <Button className="shrink-0" htmlType="button" onClick={onReset}>
        {resolvedResetText}
      </Button>
      <Button className="shrink-0" type="primary" htmlType="submit" loading={submitLoading}>
        {resolvedSubmitText}
      </Button>
    </>
  )
  const resolvedActions = resolvedExtraActions ? (
    extraActionsPlacement === 'before-primary-actions' ? (
      <>
        {resolvedExtraActions}
        {extraActionsDivider ? <Divider orientation="vertical" className="!mx-0 !h-5" /> : null}
        {resolvedPrimaryActions}
      </>
    ) : (
      <>
        {resolvedPrimaryActions}
        {resolvedExtraActions}
      </>
    )
  ) : (
    resolvedPrimaryActions
  )

  return (
    <Form<TValues>
      form={form}
      layout="inline"
      className="w-full"
      {...formProps}
      onFinish={onSubmit}
      onValuesChange={(_, allValues) => {
        onValuesChange?.(allValues as TValues)
      }}
    >
      <Row
        className={compactLayout ? 'w-full gap-x-4 gap-y-3' : 'w-full'}
        gutter={compactLayout ? undefined : rowGutter}
      >
        {fields.map((field, index) => (
          <TemplateListFilterFieldNode
            key={field.key ?? `template-list-filter-field-${index}`}
            field={field}
            form={form}
            values={values}
            defaultColProps={fieldColProps}
            labelCol={labelCol}
            wrapperCol={wrapperCol}
            compactLayout={compactLayout}
          />
        ))}
        {compactLayout ? (
          <div className="ml-auto shrink-0">
            <Form.Item className="!mb-0 !mr-0">
              <div className="flex justify-end gap-2">{resolvedActions}</div>
            </Form.Item>
          </div>
        ) : (
          <Col {...actionsColProps}>
            <Form.Item className="!mb-0 !mr-0">
              <div className="flex justify-end gap-2">{resolvedActions}</div>
            </Form.Item>
          </Col>
        )}
      </Row>
    </Form>
  )
}
