import dayjs from 'dayjs'
import type { FormEntity } from '../../../pages/templates/form/api'
import type { RuleItem } from '../../../pages/templates/list/api'

export const templateRuleData: RuleItem[] = Array.from({ length: 36 }, (_, index) => ({
  key: String(index + 1),
  name: `TradeCode ${index}`,
  desc: `模板规则描述 ${index + 1}`,
  callNo: 80 + index * 17,
  status: (index % 4) as RuleItem['status'],
  updatedAt: dayjs().subtract(index * 3 + 1, 'hour').toISOString(),
}))

export const templateFormData: FormEntity[] = templateRuleData.map((rule, index) => ({
  resourceKey: rule.key,
  title: `${rule.name} 目标`,
  dateRangeStart: dayjs().subtract(index + 3, 'day').startOf('day').toISOString(),
  dateRangeEnd: dayjs().add(index + 7, 'day').endOf('day').toISOString(),
  goal: `围绕 ${rule.name} 的目标描述`,
  standard: `${rule.name} 的衡量标准`,
  client: `客户${index + 1}`,
  invites: `同事${index + 1}`,
  weight: 30 + index * 10,
  publicType: index % 2 === 0 ? '1' : '2',
  publicUsers: index % 2 === 0 ? [] : ['同事甲', '同事乙'],
}))
