import { describe, expect, it } from '@rstest/core'

import { getTimeZoneOptions, isValidTimeZone } from './time-zones'

describe('time zone options', () => {
  it('includes UTC, common zones, and a valid saved value without duplicates', () => {
    const options = getTimeZoneOptions('Pacific/Auckland', 'Pacific/Auckland')
    const values = options.map(({ value }) => value)

    expect(values[0]).toBe('UTC')
    expect(values).toContain('Asia/Shanghai')
    expect(values).toContain('Pacific/Auckland')
    expect(values.filter((value) => value === 'Pacific/Auckland')).toHaveLength(1)
  })

  it('rejects invalid zones', () => {
    expect(isValidTimeZone('America/New_York')).toBe(true)
    expect(isValidTimeZone('Mars/Base')).toBe(false)
  })
})
