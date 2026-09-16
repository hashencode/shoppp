import { describe, expect, it } from '@rstest/core'
import {
  ACTION_COLUMN_MAX_WIDTH,
  resolveActionColumnLayout,
  resolveActionRowLayout,
} from './resolve-action-column-width'

describe('resolveActionColumnLayout', () => {
  it('keeps or wraps at each density boundary', () => {
    expect(resolveActionColumnLayout([[248]], 'large')).toMatchObject({
      mode: 'single',
      columnWidth: ACTION_COLUMN_MAX_WIDTH,
      isSupported: true,
    })
    expect(resolveActionColumnLayout([[116, 116]], 'large')).toMatchObject({
      mode: 'wrapped',
      maxSingleLineContentWidth: 249,
      maxRowContentWidth: 116,
      columnWidth: 148,
      isSupported: true,
    })
    expect(resolveActionColumnLayout([[264]], 'middle').mode).toBe('single')
  })

  it('preserves order and chooses the earlier cut when widths tie', () => {
    expect(resolveActionRowLayout([30, 58, 58, 30, 58])).toEqual({
      rows: [
        [30, 58],
        [58, 30, 58],
      ],
      splitIndex: 2,
      singleLineContentWidth: 302,
      maxRowContentWidth: 180,
    })
  })

  it('reports unsupported two-row results without clipping', () => {
    expect(resolveActionColumnLayout([[200, 200, 200]], 'large')).toMatchObject({
      mode: 'wrapped',
      columnWidth: 449,
      isSupported: false,
    })
  })
})
