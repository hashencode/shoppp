export type ActionColumnTableSize = 'large' | 'middle' | 'small'

const ACTION_COLUMN_WIDTH_DELTA_BY_TABLE_SIZE: Record<ActionColumnTableSize, number> = {
  large: 32,
  middle: 16,
  small: 16,
}

export const resolveActionColumnWidth = (
  baseWidth: number,
  tableSize: ActionColumnTableSize,
  maxWidth?: number
) => {
  const resolvedWidth = baseWidth + ACTION_COLUMN_WIDTH_DELTA_BY_TABLE_SIZE[tableSize]
  return typeof maxWidth === 'number' ? Math.min(resolvedWidth, maxWidth) : resolvedWidth
}
