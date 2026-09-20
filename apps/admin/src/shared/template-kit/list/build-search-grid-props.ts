import type { ColProps } from 'antd'

type SearchGridField = { colProps?: ColProps }
const BREAKPOINTS = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'] as const
type Breakpoint = (typeof BREAKPOINTS)[number]

const FORM_ITEM_COL_PROPS = { xs: 24, sm: 12, md: 8, xl: 6 }

const getSpan = (value: ColProps['xs']) => {
  if (typeof value === 'number') return value
  return typeof value === 'object' && value !== null && typeof value.span === 'number'
    ? value.span
    : undefined
}

export const resolveSearchGridFieldColProps = (
  colProps: ColProps | undefined,
  defaultColProps: ColProps
): ColProps => {
  if (!colProps || typeof colProps.span === 'number' || getSpan(colProps.xs) !== undefined) {
    return colProps ?? defaultColProps
  }

  const defaultXsSpan =
    getSpan(defaultColProps.xs) ??
    (typeof defaultColProps.span === 'number' ? defaultColProps.span : 24)
  return {
    ...colProps,
    xs:
      typeof colProps.xs === 'object' && colProps.xs !== null
        ? { ...colProps.xs, span: defaultXsSpan }
        : defaultXsSpan,
  }
}

const responsiveSpan = (colProps: ColProps, breakpoint: Breakpoint, fallback: number) => {
  for (let index = BREAKPOINTS.indexOf(breakpoint); index >= 0; index -= 1) {
    const key = BREAKPOINTS[index]
    if (!key) continue
    const span = getSpan(colProps[key])
    if (span !== undefined) return span
  }
  return typeof colProps.span === 'number' ? colProps.span : fallback
}

const defaultSpan = (breakpoint: Breakpoint) => responsiveSpan(FORM_ITEM_COL_PROPS, breakpoint, 24)

const actionsOffset = (fields: SearchGridField[], breakpoint: Breakpoint) => {
  let occupiedSpan = 0
  fields.forEach((field) => {
    const colProps = resolveSearchGridFieldColProps(field.colProps, FORM_ITEM_COL_PROPS)
    const fieldSpan = responsiveSpan(colProps, breakpoint, defaultSpan(breakpoint))
    occupiedSpan = occupiedSpan + fieldSpan > 24 ? fieldSpan : occupiedSpan + fieldSpan
    if (occupiedSpan === 24) occupiedSpan = 0
  })

  const actionSpan = defaultSpan(breakpoint)
  return occupiedSpan + actionSpan > 24 ? 24 - actionSpan : 24 - occupiedSpan - actionSpan
}

export const buildSearchGridProps = (visibleFields: SearchGridField[]) => ({
  formItem: FORM_ITEM_COL_PROPS,
  labelItem: { xs: 9, sm: 7, md: 10, xl: 8 },
  inputItem: { xs: 15, sm: 17, md: 14, xl: 16 },
  actions: {
    xs: { span: 24, offset: actionsOffset(visibleFields, 'xs') },
    sm: { span: 12, offset: actionsOffset(visibleFields, 'sm') },
    md: { span: 8, offset: actionsOffset(visibleFields, 'md') },
    lg: { span: 8, offset: actionsOffset(visibleFields, 'lg') },
    xl: { span: 6, offset: actionsOffset(visibleFields, 'xl') },
    xxl: { span: 6, offset: actionsOffset(visibleFields, 'xxl') },
  },
})
