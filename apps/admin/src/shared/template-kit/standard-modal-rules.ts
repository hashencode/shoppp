import type { ModalProps } from 'antd'

export const STANDARD_MODAL_WIDE_WIDTH_THRESHOLD = 1000
export const STANDARD_MODAL_WIDE_TOP = 24

export const buildStandardModalProps = (width: number): Pick<ModalProps, 'width' | 'style'> => ({
  width,
  style:
    width >= STANDARD_MODAL_WIDE_WIDTH_THRESHOLD ? { top: STANDARD_MODAL_WIDE_TOP } : undefined,
})
