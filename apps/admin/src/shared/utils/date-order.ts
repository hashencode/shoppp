import type { Dayjs } from 'dayjs'

export const isStartDateAfterEndDate = (
  startDate: Dayjs | null | undefined,
  endDate: Dayjs | null | undefined
): boolean => Boolean(startDate && endDate && startDate.isAfter(endDate, 'day'))
