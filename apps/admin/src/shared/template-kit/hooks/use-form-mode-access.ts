import { useMemo } from 'react'
import { hasPermission } from '../../../infrastructure/auth/permissions'
import {
  getFormModeViewModel,
  parseFormModeParams,
  type ParsedFormMode,
} from '../../../routes/form-route-contract'
import type { Role } from '../../types/roles'

type UseFormModeAccessOptions = {
  searchParams: URLSearchParams
  role: Role
}

type FormModeAccessResult = {
  parsedMode: ParsedFormMode
  modeView: ReturnType<typeof getFormModeViewModel> | null
  isReadonly: boolean
  permissionDenied: boolean
}

export const useFormModeAccess = ({
  searchParams,
  role,
}: UseFormModeAccessOptions): FormModeAccessResult => {
  const parsedMode = useMemo(() => parseFormModeParams(searchParams), [searchParams])
  const modeView = useMemo(
    () => (parsedMode.ok ? getFormModeViewModel(parsedMode.mode) : null),
    [parsedMode]
  )

  const permissionDenied = useMemo(() => {
    if (!parsedMode.ok) {
      return false
    }

    if (parsedMode.mode === 'readonly') {
      return !hasPermission(role, 'form.read')
    }

    return !hasPermission(role, 'form.write')
  }, [parsedMode, role])

  return {
    parsedMode,
    modeView,
    isReadonly: !modeView?.canEdit,
    permissionDenied,
  }
}
