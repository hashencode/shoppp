export type ActionColumnTableSize = 'large' | 'middle' | 'small'

export type ActionColumnLayoutMode = 'single' | 'wrapped'

export interface ActionRowLayout {
  rows: ReadonlyArray<ReadonlyArray<number>>
  splitIndex: number | null
  singleLineContentWidth: number
  maxRowContentWidth: number
}

export interface ActionColumnLayout {
  mode: ActionColumnLayoutMode
  maxSingleLineContentWidth: number
  maxRowContentWidth: number
  columnWidth: number
  isSupported: boolean
  error: string | null
}

export const ACTION_COLUMN_MAX_WIDTH = 280
export const ACTION_COLUMN_DIVIDER_WIDTH = 17

const ACTION_COLUMN_WIDTH_DELTA_BY_TABLE_SIZE: Record<ActionColumnTableSize, number> = {
  large: 32,
  middle: 16,
  small: 16,
}

const resolveActionRowContentWidth = (contentWidths: ReadonlyArray<number>) =>
  contentWidths.reduce((total, width) => total + width, 0) +
  Math.max(contentWidths.length - 1, 0) * ACTION_COLUMN_DIVIDER_WIDTH

export const resolveActionRowLayout = (contentWidths: ReadonlyArray<number>): ActionRowLayout => {
  const singleLineContentWidth = resolveActionRowContentWidth(contentWidths)

  if (contentWidths.length <= 1) {
    return {
      rows: [contentWidths],
      splitIndex: null,
      singleLineContentWidth,
      maxRowContentWidth: singleLineContentWidth,
    }
  }

  let splitIndex = 1
  let prefixWidth = contentWidths[0] ?? 0
  const totalWidth = contentWidths.reduce((total, width) => total + width, 0)
  let maxRowContentWidth = Math.max(
    prefixWidth,
    totalWidth -
      prefixWidth +
      Math.max(contentWidths.length - splitIndex - 1, 0) * ACTION_COLUMN_DIVIDER_WIDTH
  )

  for (
    let currentSplitIndex = 2;
    currentSplitIndex < contentWidths.length;
    currentSplitIndex += 1
  ) {
    prefixWidth += contentWidths[currentSplitIndex - 1] ?? 0
    const currentMaxRowContentWidth = Math.max(
      prefixWidth + (currentSplitIndex - 1) * ACTION_COLUMN_DIVIDER_WIDTH,
      totalWidth -
        prefixWidth +
        Math.max(contentWidths.length - currentSplitIndex - 1, 0) * ACTION_COLUMN_DIVIDER_WIDTH
    )

    if (currentMaxRowContentWidth < maxRowContentWidth) {
      splitIndex = currentSplitIndex
      maxRowContentWidth = currentMaxRowContentWidth
    }
  }

  return {
    rows: [contentWidths.slice(0, splitIndex), contentWidths.slice(splitIndex)],
    splitIndex,
    singleLineContentWidth,
    maxRowContentWidth,
  }
}

export const resolveActionColumnWidth = (
  baseWidth: number,
  tableSize: ActionColumnTableSize,
  maxWidth?: number
) => {
  const resolvedWidth = baseWidth + ACTION_COLUMN_WIDTH_DELTA_BY_TABLE_SIZE[tableSize]
  return typeof maxWidth === 'number' ? Math.min(resolvedWidth, maxWidth) : resolvedWidth
}

export const resolveActionColumnLayout = (
  reachableContentWidthCombinations: ReadonlyArray<ReadonlyArray<number>>,
  tableSize: ActionColumnTableSize
): ActionColumnLayout => {
  const rowLayouts = reachableContentWidthCombinations.map(resolveActionRowLayout)
  const maxSingleLineContentWidth = Math.max(
    0,
    ...rowLayouts.map(({ singleLineContentWidth }) => singleLineContentWidth)
  )
  const mode: ActionColumnLayoutMode =
    resolveActionColumnWidth(maxSingleLineContentWidth, tableSize) <= ACTION_COLUMN_MAX_WIDTH
      ? 'single'
      : 'wrapped'
  const maxRowContentWidth =
    mode === 'single'
      ? maxSingleLineContentWidth
      : Math.max(0, ...rowLayouts.map(({ maxRowContentWidth }) => maxRowContentWidth))
  const columnWidth = resolveActionColumnWidth(maxRowContentWidth, tableSize)
  const isSupported = columnWidth <= ACTION_COLUMN_MAX_WIDTH

  return {
    mode,
    maxSingleLineContentWidth,
    maxRowContentWidth,
    columnWidth,
    isSupported,
    error: isSupported
      ? null
      : `Action column requires ${columnWidth}px after two-row layout, exceeding the supported ${ACTION_COLUMN_MAX_WIDTH}px maximum.`,
  }
}
