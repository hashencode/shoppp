export type ListStateCopyContract = Partial<{
  loadingTitle: string
  errorTitle: string
  errorDescription: string
  errorActionLabel: string
  partialTitle: string
  partialDescription: string
  partialActionLabel: string
  emptyTitle: string
  emptyDescription: string
  emptyActionLabel: string
}>

export type FormStateCopyContract = {
  submitBlockedMessage?: string
  submitSuccessMessage: string
}
