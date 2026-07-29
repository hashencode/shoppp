import { Button, Card, Form, Steps } from 'antd'
import React from 'react'
import { PageHeaderWithBack } from '../../components/form-page-header'
import {
  FORM_CONTENT_ALIGN_CLASS_NAME,
  resolveFormContentWidthClassName,
} from '../form/form-content-width'
import type { StepFormSpec } from '../specs/step-form-spec'

void React

export const StepFormRecipe = <TValues extends object>({ spec }: { spec: StepFormSpec<TValues> }) => {
  return (
    <div className="space-y-4">
      <PageHeaderWithBack title={spec.title} onBack={spec.onBackToList} />
      <Card variant="borderless">
        <div
          className={`${FORM_CONTENT_ALIGN_CLASS_NAME} ${resolveFormContentWidthClassName(spec)} [&_.ant-steps-item-title]:!text-sm`}
        >
          <Steps className="mb-10" current={spec.currentStep} items={spec.steps} />

          <Form<TValues>
            form={spec.form}
            layout="vertical"
            requiredMark={spec.requiredMark ?? false}
            initialValues={spec.initialValues}
            className={spec.minBodyHeightClassName ?? 'min-h-[320px]'}
          >
            {spec.renderStepContent()}
          </Form>

          {spec.showStepActions ? (
            <div className="mt-8 flex gap-2">
              {spec.currentStep > 0 ? (
                <Button onClick={spec.onPrevStep} disabled={spec.submitting}>
                  上一步
                </Button>
              ) : null}
              <Button
                type="primary"
                loading={spec.submitting}
                disabled={spec.submitting}
                onClick={() => {
                  void spec.onPrimaryAction()
                }}
              >
                {spec.primaryActionLabel}
              </Button>
            </div>
          ) : null}
        </div>

        {spec.renderBottomNotes ?? null}
      </Card>
    </div>
  )
}
