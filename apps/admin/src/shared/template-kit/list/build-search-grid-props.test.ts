import { describe, expect, it } from '@rstest/core'
import { buildSearchGridProps } from './build-search-grid-props'

describe('buildSearchGridProps', () => {
  it('keeps action placement for standard-width fields', () => {
    expect(buildSearchGridProps(Array.from({ length: 5 }, () => ({}))).actions).toEqual({
      xs: { span: 24, offset: 0 },
      sm: { span: 12, offset: 0 },
      md: { span: 8, offset: 0 },
      lg: { span: 8, offset: 0 },
      xl: { span: 6, offset: 12 },
      xxl: { span: 6, offset: 12 },
    })
  })

  it('places actions after a double-width field at each breakpoint', () => {
    const fields = [
      ...Array.from({ length: 8 }, () => ({})),
      { colProps: { xs: 24, sm: 24, md: 16, xl: 12 } },
    ]

    expect(buildSearchGridProps(fields).actions).toEqual({
      xs: { span: 24, offset: 0 },
      sm: { span: 12, offset: 12 },
      md: { span: 8, offset: 0 },
      lg: { span: 8, offset: 0 },
      xl: { span: 6, offset: 6 },
      xxl: { span: 6, offset: 6 },
    })
  })

  it('inherits partial responsive spans and object-form spans', () => {
    expect(buildSearchGridProps([{ colProps: { sm: 24, xl: { span: 12 } } }]).actions).toEqual({
      xs: { span: 24, offset: 0 },
      sm: { span: 12, offset: 12 },
      md: { span: 8, offset: 16 },
      lg: { span: 8, offset: 16 },
      xl: { span: 6, offset: 6 },
      xxl: { span: 6, offset: 6 },
    })
  })
})
