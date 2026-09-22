import type { Dayjs } from 'dayjs'
import { isStartDateAfterEndDate } from '../../utils/date-order'

type DateFieldReader = {
  getFieldValue: (name: string) => unknown
}

export const DATE_ORDER_ERROR_MESSAGE = '开始日期不能晚于结束日期'

export const buildDateOrderRule = (startField: string, endField: string) =>
  ({ getFieldValue }: DateFieldReader) => ({
    validator: async () => {
      const startDate = getFieldValue(startField) as Dayjs | null | undefined
      const endDate = getFieldValue(endField) as Dayjs | null | undefined

      if (isStartDateAfterEndDate(startDate, endDate)) {
        throw new Error(DATE_ORDER_ERROR_MESSAGE)
      }
    },
  })
