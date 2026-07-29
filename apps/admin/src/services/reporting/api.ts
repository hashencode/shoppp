import type {
  ReportExport,
  ReportExportRequest,
  ReportOrderRow,
  ReportingQuery,
  RevenueReport,
} from '@shoppp/contracts'
import { apiClient } from '../../infrastructure/http/api-client'

export type ReportOrderFilters = ReportingQuery & {
  page?: number
  pageSize?: number
  query?: string
}

export const fetchRevenueReport = async (query: ReportingQuery): Promise<RevenueReport> => {
  const response = await apiClient.get<{ data: RevenueReport }>('/admin/reporting/revenue', {
    params: query,
  })
  return response.data.data
}

export const fetchReportOrders = async (
  filters: ReportOrderFilters
): Promise<{ data: ReportOrderRow[]; page: number; pageSize: number; total: number }> => {
  const response = await apiClient.get<{
    data: ReportOrderRow[]
    meta: { page: number; pageSize: number; total: number }
  }>('/admin/reporting/orders', { params: filters })
  return { data: response.data.data, ...response.data.meta }
}

export const createReportExport = async (
  input: ReportExportRequest
): Promise<ReportExport> => {
  const response = await apiClient.post<{ data: ReportExport }>(
    '/admin/reporting/exports',
    input,
    {
      headers: {
        'Idempotency-Key': `report-export-${crypto.randomUUID()}`,
      },
    }
  )
  return response.data.data
}

export const reportExportDownloadUrl = (id: string): string =>
  `/admin/reporting/exports/${encodeURIComponent(id)}/download`
