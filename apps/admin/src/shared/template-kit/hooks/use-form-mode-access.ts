import { useMemo } from 'react'
import { hasPermission } from '../../../infrastructure/auth/permissions'
import {
  getFormModeViewModel,
  parseFormModeParams,
  type ParsedFormMode,
} from '../../../routes/form-route-contract'
import type { Role } from '../../types/roles'
import type { PermissionKey } from '../../../infrastructure/auth/permissions'

type UseFormModeAccessOptions = {
  searchParams: URLSearchParams
  role: Role
  permissions?: readonly PermissionKey[]
  readPermission?: PermissionKey
  writePermission?: PermissionKey
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
  permissions,
  readPermission = 'form.read',
  writePermission = 'form.write',
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
      return !hasPermission(role, readPermission, permissions)
    }

    return !hasPermission(role, writePermission, permissions)
  }, [parsedMode, permissions, readPermission, role, writePermission])

  return {
    parsedMode,
    modeView,
    isReadonly: !modeView?.canEdit,
    permissionDenied,
  }
}
