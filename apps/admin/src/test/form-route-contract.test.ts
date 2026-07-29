import { describe, expect, it } from '@rstest/core'
import { buildFormPageUrl, getFormModeViewModel, parseFormModeParams } from '../routes/form-route-contract'

describe('form mode parser', () => {
  it('defaults to add mode when mode is missing', () => {
    const result = parseFormModeParams(new URLSearchParams())

    expect(result).toEqual({
      ok: true,
      mode: 'add',
    })
  })

  it('parses add mode without resource key', () => {
    const result = parseFormModeParams(new URLSearchParams('mode=add'))

    expect(result).toEqual({
      ok: true,
      mode: 'add',
    })
  })

  it('parses modify mode with id', () => {
    const result = parseFormModeParams(new URLSearchParams('mode=modify&id=1'))

    expect(result).toEqual({
      ok: true,
      mode: 'modify',
      resourceKey: '1',
    })
  })

  it('parses readonly mode with resourceKey fallback', () => {
    const result = parseFormModeParams(new URLSearchParams('mode=readonly&resourceKey=8'))

    expect(result).toEqual({
      ok: true,
      mode: 'readonly',
      resourceKey: '8',
    })
  })

  it('returns missing id error for readonly mode without resource key', () => {
    const result = parseFormModeParams(new URLSearchParams('mode=readonly'))

    expect(result).toEqual({
      ok: false,
      errorCode: 'ROUTE_PARAM_MISSING_ID',
      message: 'modify / readonly 模式必须携带 id 或 resourceKey。',
    })
  })

  it('returns invalid mode error for unsupported mode', () => {
    const result = parseFormModeParams(new URLSearchParams('mode=detail&id=1'))

    expect(result).toEqual({
      ok: false,
      errorCode: 'ROUTE_PARAM_INVALID',
      message: 'mode 参数非法，仅支持 add / modify / readonly。',
    })
  })

  it('builds form page url with id', () => {
    expect(buildFormPageUrl('readonly', '9')).toBe('/template/list/table/form?mode=readonly&id=9')
  })

  it('builds form page url without id for add mode', () => {
    expect(buildFormPageUrl('add')).toBe('/template/list/table/form?mode=add')
  })

  it('builds mode view model for readonly mode', () => {
    expect(getFormModeViewModel('readonly')).toMatchObject({
      canEdit: false,
      canFetch: true,
      showActions: false,
    })
  })
})
