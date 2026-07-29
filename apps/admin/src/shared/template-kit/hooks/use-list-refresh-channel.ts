import { useCallback, useEffect } from 'react'

type UseListRefreshChannelOptions = {
  channelName: string
  eventType: string
  onRefresh?: () => void
}

type ListRefreshPayload = {
  source?: string
  ts?: number
}

export const useListRefreshChannel = ({
  channelName,
  eventType,
  onRefresh,
}: UseListRefreshChannelOptions) => {
  useEffect(() => {
    if (!onRefresh) {
      return
    }

    const channel = new BroadcastChannel(channelName)
    channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === eventType) {
        onRefresh()
      }
    }

    return () => {
      channel.close()
    }
  }, [channelName, eventType, onRefresh])

  const publishRefresh = useCallback(
    (payload: ListRefreshPayload = {}) => {
      const channel = new BroadcastChannel(channelName)
      channel.postMessage({
        type: eventType,
        source: payload.source,
        ts: payload.ts ?? Date.now(),
      })
      channel.close()
    },
    [channelName, eventType]
  )

  return {
    publishRefresh,
  }
}
