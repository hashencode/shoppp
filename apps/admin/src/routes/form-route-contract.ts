export const FORM_MODES = ['add', 'modify', 'readonly'] as const

export type FormMode = (typeof FORM_MODES)[number]

export type FormModeErrorCode = 'ROUTE_PARAM_INVALID' | 'ROUTE_PARAM_MISSING_ID'

type ParseSuccess = {
  ok: true
  mode: FormMode
  resourceKey?: string
}

type ParseFailure = {
  ok: false
  errorCode: FormModeErrorCode
  message: string
}

export type ParsedFormMode = ParseSuccess | ParseFailure

export const parseFormModeParams = (searchParams: URLSearchParams): ParsedFormMode => {
  const rawMode = searchParams.get('mode') ?? 'add'

  if (!FORM_MODES.includes(rawMode as FormMode)) {
    return {
      ok: false,
      errorCode: 'ROUTE_PARAM_INVALID',
      message: 'mode 参数非法，仅支持 add / modify / readonly。',
    }
  }

  const mode = rawMode as FormMode

  if (mode === 'add') {
    return {
      ok: true,
      mode,
    }
  }

  const resourceKey = searchParams.get('resourceKey') ?? searchParams.get('id')

  if (!resourceKey) {
    return {
      ok: false,
      errorCode: 'ROUTE_PARAM_MISSING_ID',
      message: 'modify / readonly 模式必须携带 id 或 resourceKey。',
    }
  }

  return {
    ok: true,
    mode,
    resourceKey,
  }
}

export const buildFormPageUrl = (mode: FormMode, resourceKey?: string): string => {
  const params = new URLSearchParams({ mode })

  if (resourceKey) {
    params.set('id', resourceKey)
  }

  return `/template/list/table/form?${params.toString()}`
}

export type FormModeViewModel = {
  mode: FormMode
  canEdit: boolean
  canFetch: boolean
  showActions: boolean
}

export const getFormModeViewModel = (mode: FormMode): FormModeViewModel => {
  if (mode === 'add') {
    return {
      mode,
      canEdit: true,
      canFetch: false,
      showActions: true,
    }
  }

  if (mode === 'modify') {
    return {
      mode,
      canEdit: true,
      canFetch: true,
      showActions: true,
    }
  }

  return {
    mode,
    canEdit: false,
    canFetch: true,
    showActions: false,
  }
}
