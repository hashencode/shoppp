type SearchGridProps = {
  formItem: { xs: number; sm: number; md: number; xl: number }
  labelItem: { xs: number; sm: number; md: number; xl: number }
  inputItem: { xs: number; sm: number; md: number; xl: number }
  actions: {
    xs: { span: number }
    sm: { span: number; offset: number }
    md: { span: number; offset: number }
    xl: { span: number; offset: number }
  }
}

export const buildSearchGridProps = (visibleFieldCount: number): SearchGridProps => ({
  formItem: { xs: 24, sm: 12, md: 8, xl: 6 },
  labelItem: { xs: 9, sm: 7, md: 10, xl: 8 },
  inputItem: { xs: 15, sm: 17, md: 14, xl: 16 },
  actions: {
    xs: { span: 24 },
    sm: { span: 12, offset: (1 - (visibleFieldCount % 2)) * 12 },
    md: { span: 8, offset: (2 - (visibleFieldCount % 3)) * 8 },
    xl: { span: 6, offset: (3 - (visibleFieldCount % 4)) * 6 },
  },
})
