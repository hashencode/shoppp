export type SalesType = 'all' | 'online' | 'stores'

export const rankingStores = Array.from({ length: 7 }).map((_, index) => ({
  rank: index + 1,
  name: `工专路 ${index + 1} 号店`,
  total: 323234 - index * 3260,
}))

export const searchData = [
  { key: 1, keyword: 'Ant Design Pro', count: 12321, range: 12.3, down: false },
  { key: 2, keyword: 'Admin Layout', count: 11320, range: 8.2, down: false },
  { key: 3, keyword: 'Route Contract', count: 10620, range: 6.1, down: true },
  { key: 4, keyword: 'Permission Guard', count: 9920, range: 5.6, down: false },
  { key: 5, keyword: 'Analysis Dashboard', count: 9124, range: 4.3, down: false },
]

const pieSourceByType: Record<SalesType, { value: number; name: string }[]> = {
  all: [
    { value: 4544, name: '家用电器' },
    { value: 3321, name: '食用酒水' },
    { value: 3113, name: '个护健康' },
    { value: 2341, name: '服饰箱包' },
  ],
  online: [
    { value: 3120, name: '线上支付' },
    { value: 2440, name: '小程序' },
    { value: 1900, name: '官网渠道' },
  ],
  stores: [
    { value: 2920, name: '门店收银' },
    { value: 2100, name: '会员活动' },
    { value: 1600, name: '线下团购' },
  ],
}

export const getPieSource = (salesType: SalesType) => pieSourceByType[salesType]
