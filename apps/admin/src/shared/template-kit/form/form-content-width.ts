import type { FormContentWidthPreset } from '../specs/basic-crud-form-spec'

export const FORM_CONTENT_ALIGN_CLASS_NAME = 'admin-form-content-align'

export const FORM_CONTENT_WIDTH_CLASS_NAME = {
  compact: 'w-full max-w-[800px]',
  wide: 'w-full max-w-[1200px]',
  full: 'w-full',
} satisfies Record<FormContentWidthPreset, string>

export const FORM_CARD_BODY_WIDTH_CLASS_NAME = {
  compact: `${FORM_CONTENT_ALIGN_CLASS_NAME} ${FORM_CONTENT_WIDTH_CLASS_NAME.compact}`,
  wide: `${FORM_CONTENT_ALIGN_CLASS_NAME} ${FORM_CONTENT_WIDTH_CLASS_NAME.wide}`,
  full: FORM_CONTENT_WIDTH_CLASS_NAME.full,
} satisfies Record<FormContentWidthPreset, string>

export const resolveFormContentWidthClassName = ({
  contentWidthPreset,
  maxWidthClassName,
}: {
  contentWidthPreset?: FormContentWidthPreset
  maxWidthClassName?: string
}) => maxWidthClassName ?? FORM_CONTENT_WIDTH_CLASS_NAME[contentWidthPreset ?? 'compact']
