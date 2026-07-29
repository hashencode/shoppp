import type { CSSProperties } from 'react'
import React, { useEffect, useMemo, useRef } from 'react'
import { DefaultPreset, Events, SimplePlayer, type IPlayerOptions } from 'xgplayer'
import './video-player.css'

void React

export type VideoSourceKind = 'hls' | 'mp4'

export type VideoPlayerProps = {
  source: string
  sourceKind: VideoSourceKind
  primaryColor: string
  onError: (message: string) => void
  className?: string
  height?: number | string
  style?: CSSProperties
}

type PlayerInstance = InstanceType<typeof SimplePlayer>

type ActivePlayer = {
  errorHandler: () => void
  player: PlayerInstance
}

class VideoPlayerPreset extends DefaultPreset {
  constructor(options: unknown, playerConfig: IPlayerOptions) {
    super(options, playerConfig)
    this.ignores = [...this.ignores, 'download']
  }
}

const canPlayNativeHls = () =>
  typeof document !== 'undefined' &&
  Boolean(document.createElement('video').canPlayType('application/vnd.apple.mpegurl'))

const destroyPlayer = (activePlayer: ActivePlayer | null) => {
  if (!activePlayer) {
    return
  }

  const { errorHandler, player } = activePlayer
  try {
    player.off(Events.ERROR, errorHandler)

    const media = player.video
    if (media && 'pause' in media && typeof media.pause === 'function') {
      media.pause()
    }
    if (media && 'currentTime' in media) {
      media.currentTime = 0
    }
  } finally {
    player.destroy()
  }
}

const loadPlaybackPlugin = async (sourceKind: VideoSourceKind) => {
  if (sourceKind === 'hls') {
    if (canPlayNativeHls()) {
      return undefined
    }

    const hlsModule = await import('xgplayer-hls')
    return hlsModule.HlsPlugin ?? hlsModule.default
  }

  const mp4Module = await import('xgplayer-mp4')
  return mp4Module.default
}

export const VideoPlayer = ({
  source,
  sourceKind,
  primaryColor,
  onError,
  className,
  height = 480,
  style,
}: VideoPlayerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<ActivePlayer | null>(null)
  const normalizedSource = useMemo(() => source.trim(), [source])

  useEffect(() => {
    const clearCurrentPlayer = () => {
      destroyPlayer(playerRef.current)
      playerRef.current = null
    }

    clearCurrentPlayer()
    if (!normalizedSource || !containerRef.current) {
      return
    }

    let disposed = false

    const bootstrap = async () => {
      try {
        const playbackPlugin = await loadPlaybackPlugin(sourceKind)
        if (disposed || !containerRef.current) {
          return
        }

        const playerOptions: IPlayerOptions = {
          el: containerRef.current,
          url: normalizedSource,
          width: '100%',
          height,
          fitVideoSize: 'fixWidth',
          lang: 'zh-cn',
          autoplay: false,
          videoInit: true,
          playsinline: true,
          download: false,
          ignores: ['download'],
          presets: [VideoPlayerPreset],
          commonStyle: {
            playedColor: primaryColor,
            sliderBtnStyle: {
              boxShadow: 'none',
            },
          },
        }

        if (playbackPlugin) {
          playerOptions.plugins = [playbackPlugin]
        }

        const player = new SimplePlayer(playerOptions)
        const errorHandler = () => {
          if (!disposed && playerRef.current?.player === player) {
            onError('视频预览加载失败')
          }
        }

        player.on(Events.ERROR, errorHandler)
        playerRef.current = { errorHandler, player }
      } catch {
        clearCurrentPlayer()
        if (!disposed) {
          onError('视频预览加载失败')
        }
      }
    }

    void bootstrap()

    return () => {
      disposed = true
      clearCurrentPlayer()
    }
  }, [height, normalizedSource, onError, primaryColor, sourceKind])

  const resolvedClassName = className ? `video-player ${className}` : 'video-player'

  return (
    <div className={resolvedClassName} style={style}>
      <div ref={containerRef} className="video-player-stage" />
    </div>
  )
}
