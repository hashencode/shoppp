import { Card, Form } from 'antd'
import React from 'react'
import { PageHeaderWithBack } from '../../components/form-page-header'
import { FormSubmitToolbar } from '../../components/form-submit-toolbar'
import {
  FORM_CARD_BODY_WIDTH_CLASS_NAME,
  FORM_CONTENT_ALIGN_CLASS_NAME,
  resolveFormContentWidthClassName,
} from '../form/form-content-width'
import type { BasicCrudFormSpec } from '../specs/basic-crud-form-spec'
import { TemplateFormStateGate } from '../form/template-form-state-gate'
import { FORM_ERROR_SCROLL_OPTIONS } from '../form/form-validation-scroll'

void React

const resolveSectionBodyClassName = ({
  contentWidthPreset,
  maxWidthClassName,
}: {
  contentWidthPreset?: BasicCrudFormSpec<object>['contentWidthPreset']
  maxWidthClassName?: string
}) => {
  if (maxWidthClassName) {
    return `${FORM_CONTENT_ALIGN_CLASS_NAME} ${maxWidthClassName}`
  }

  return FORM_CARD_BODY_WIDTH_CLASS_NAME[contentWidthPreset ?? 'compact']
}

export const BasicCrudFormRecipe = <TValues extends object>({
  spec,
}: {
  spec: BasicCrudFormSpec<TValues>
}) => {
  const formActions = spec.modeView?.showActions ? (
    <FormSubmitToolbar
      submitHtmlType="submit"
      submitLoading={spec.saveLoading}
      submitDisabled={spec.saveLoading || spec.isReadonly}
      onReset={spec.onResetAll}
    />
  ) : null
  const sections = spec.sections?.length ? spec.sections : null

  return (
    <TemplateFormStateGate
      parsedMode={spec.parsedMode}
      modeView={spec.modeView}
      permissionDenied={spec.permissionDenied}
      detailLoading={spec.detailLoading}
      detailError={spec.detailError}
      onBackToList={spec.onBackToList}
      onRetryDetail={spec.onRetryDetail}
    >
      <div className="space-y-4 pb-20">
        <PageHeaderWithBack title={spec.title} onBack={spec.onBackToList} />

        {sections ? (
          <Form<TValues>
            form={spec.form}
            layout="vertical"
            initialValues={spec.initialValues}
            className="space-y-4"
            disabled={spec.isReadonly || spec.saveLoading}
            onFinish={spec.onSubmit}
            scrollToFirstError={FORM_ERROR_SCROLL_OPTIONS}
          >
            {sections.map((section) => (
              <Card
                key={section.key}
                title={section.title}
                classNames={{ body: resolveSectionBodyClassName(section) }}
              >
                {section.renderFields()}
              </Card>
            ))}
            {spec.renderAfterForm ?? null}
            {formActions}
          </Form>
        ) : (
          <Card>
            <Form<TValues>
              form={spec.form}
              layout="vertical"
              initialValues={spec.initialValues}
              className={`${FORM_CONTENT_ALIGN_CLASS_NAME} mt-2 ${resolveFormContentWidthClassName(spec)}`}
              disabled={spec.isReadonly || spec.saveLoading}
              onFinish={spec.onSubmit}
              scrollToFirstError={FORM_ERROR_SCROLL_OPTIONS}
            >
              {spec.renderFields?.()}
              {spec.renderAfterForm ?? null}
              {formActions}
            </Form>
          </Card>
        )}
      </div>
    </TemplateFormStateGate>
  )
}
