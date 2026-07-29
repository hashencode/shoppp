import type { ReactNode } from 'react'
import type { FormInstance } from 'antd'
import type { FormContentWidthPreset } from './basic-crud-form-spec'

export type StepFormSpec<TValues extends object> = {
  title: string
  form: FormInstance<TValues>
  initialValues: Partial<TValues>
  currentStep: number
  steps: Array<{
    title: string
  }>
  submitting: boolean
  primaryActionLabel: string
  showStepActions: boolean
  contentWidthPreset?: FormContentWidthPreset
  maxWidthClassName?: string
  minBodyHeightClassName?: string
  requiredMark?: boolean
  onBackToList: () => void
  onPrevStep: () => void
  onPrimaryAction: () => Promise<void>
  renderStepContent: () => ReactNode
  renderBottomNotes?: ReactNode
}
