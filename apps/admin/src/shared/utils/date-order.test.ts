import dayjs from 'dayjs'
import { describe, expect, it } from '@rstest/core'
import { isStartDateAfterEndDate } from './date-order'

describe('isStartDateAfterEndDate', () => {
  it('accepts missing, equal, and ascending dates', () => {
    expect(isStartDateAfterEndDate(undefined, dayjs('2026-09-21'))).toBe(false)
    expect(isStartDateAfterEndDate(dayjs('2026-09-21'), undefined)).toBe(false)
    expect(isStartDateAfterEndDate(dayjs('2026-09-21'), dayjs('2026-09-21'))).toBe(false)
    expect(isStartDateAfterEndDate(dayjs('2026-09-20'), dayjs('2026-09-21'))).toBe(false)
  })

  it('rejects a start date after the end date', () => {
    expect(isStartDateAfterEndDate(dayjs('2026-09-22'), dayjs('2026-09-21'))).toBe(true)
  })
})
