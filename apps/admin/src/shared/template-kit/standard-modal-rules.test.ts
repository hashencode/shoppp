import { describe, expect, it } from '@rstest/core'
import {
  STANDARD_MODAL_WIDE_TOP,
  STANDARD_MODAL_WIDE_WIDTH_THRESHOLD,
  buildStandardModalProps,
} from './standard-modal-rules'

describe('standard modal rules', () => {
  it('moves numeric-width modals upward from the wide-width threshold', () => {
    expect(buildStandardModalProps(STANDARD_MODAL_WIDE_WIDTH_THRESHOLD - 1)).toEqual({
      width: STANDARD_MODAL_WIDE_WIDTH_THRESHOLD - 1,
      style: undefined,
    })
    expect(buildStandardModalProps(STANDARD_MODAL_WIDE_WIDTH_THRESHOLD)).toEqual({
      width: STANDARD_MODAL_WIDE_WIDTH_THRESHOLD,
      style: { top: STANDARD_MODAL_WIDE_TOP },
    })
  })
})
