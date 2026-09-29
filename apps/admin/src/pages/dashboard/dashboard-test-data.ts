import type {
  ReportingQuery,
  RevenueReport,
  TrafficQuery,
  TrafficReport,
  ProductSalesReport,
} from '@shoppp/contracts'

// Deliberately different UV/PV facts; used only by test suites.
export const revenueFixture = (query: ReportingQuery): RevenueReport => ({
  ...query,
  comparison: {
    startDate: '2026-01-01',
    endDate: '2026-01-30',
    metrics: {
      grossSales: 2000,
      netSales: -100,
      orderCount: 0,
      refundTotal: 2100,
      averageOrderValue: 0,
    },
  },
  current: {
    startDate: query.startDate,
    endDate: query.endDate,
    metrics: {
      grossSales: 3500,
      netSales: -500,
      orderCount: 2,
      refundTotal: 4000,
      averageOrderValue: 1750,
    },
    series: [
      { date: query.startDate, grossSales: 1000, netSales: 1000, orderCount: 1, refundTotal: 0 },
      { date: query.endDate, grossSales: 2500, netSales: -1500, orderCount: 1, refundTotal: 4000 },
    ],
  },
  definitions: { grossSales: 'Paid orders', refundTotal: 'Completed refunds' },
})
export const trafficFixture = (query: TrafficQuery): TrafficReport => ({
  ...query,
  asOf: '2026-09-30T00:00:00Z',
  collectionStartedAt: '2026-01-01T00:00:00Z',
  storefrontOrigin: 'https://store.example.com',
  uniqueVisitors: 1,
  pageViews: 6,
  comparison: {
    startDate: '2026-01-01',
    endDate: '2026-01-30',
    uniqueVisitors: 0,
    pageViews: 0,
    available: false,
  },
  series: [
    { date: query.startDate, uniqueVisitors: 1, pageViews: 5 },
    { date: query.endDate, uniqueVisitors: 1, pageViews: 1 },
  ],
  products: [
    { productId: 'a', name: 'Product A', path: '/products/a', pageViews: 4 },
    { productId: 'b', name: 'Archived product B', path: null, pageViews: 2 },
  ],
})
export const productsFixture = (query: ReportingQuery): ProductSalesReport => ({
  ...query,
  storefrontOrigin: 'https://store.example.com',
  products: [
    { productId: 'a', name: 'Product A', path: '/products/a', grossSales: 2500 },
    { productId: 'b', name: 'Archived product B', path: null, grossSales: 1000 },
  ],
})
