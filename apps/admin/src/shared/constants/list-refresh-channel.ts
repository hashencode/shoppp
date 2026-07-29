export const LIST_REFRESH_CHANNEL = 'list-refresh-channel'

export const LIST_REFRESH_EVENT = {
  REFRESH_LIST: 'REFRESH_LIST',
} as const

export type ListRefreshEventType = (typeof LIST_REFRESH_EVENT)[keyof typeof LIST_REFRESH_EVENT]
