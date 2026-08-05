import React from 'react'
import type { ReactNode } from 'react'
import { ForbiddenPage } from '../../../pages/forbidden-page'
import { QueryStateBlock } from '../../components/query-state-block'
import type { ApiError } from '../../../infrastructure/http/api-client'
import type { ParsedFormMode, FormModeViewModel } from '../../../routes/form-route-contract'
import { useI18n } from '../../contexts/i18n-context'

void React

type TemplateFormStateGateProps = {
  parsedMode: ParsedFormMode
  modeView: FormModeViewModel | null
  permissionDenied: boolean
  detailLoading: boolean
  detailError: ApiError | null
  onBackToList: () => void
  onRetryDetail: () => void
  children: ReactNode
}

export const TemplateFormStateGate = ({
  parsedMode,
  modeView,
  permissionDenied,
  detailLoading,
  detailError,
  onBackToList,
  onRetryDetail,
  children,
}: TemplateFormStateGateProps) => {
  const { t } = useI18n()
  if (!parsedMode.ok) {
    return (
      <QueryStateBlock
        state="error"
        title={t('Invalid route parameters')}
        description={t(parsedMode.message)}
        primaryActionLabel={t('Return to list')}
        onPrimaryAction={onBackToList}
      />
    )
  }

  if (permissionDenied) {
    return <ForbiddenPage />
  }

  if (modeView?.canFetch && detailLoading) {
    return <QueryStateBlock state="loading" title={t('Loading form details…')} />
  }

  if (modeView?.canFetch && detailError) {
    const notFound = detailError.code === 'RESOURCE_NOT_FOUND' || detailError.status === 404

    return (
      <QueryStateBlock
        state={notFound ? 'empty' : 'error'}
        title={t(notFound ? 'Record not found or deleted' : 'Form details could not be loaded')}
        description={
          notFound
            ? t('Return to the list and select another record.')
            : t('Request failed. Please try again later.')
        }
        primaryActionLabel={t('Return to list')}
        onPrimaryAction={onBackToList}
        secondaryActionLabel={notFound ? undefined : t('Retry')}
        onSecondaryAction={notFound ? undefined : onRetryDetail}
      />
    )
  }

  return <>{children}</>
}
