import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, rstest } from '@rstest/core'
import { VideoPlayer } from './video-player'

void React

type PlayerOptions = {
  autoplay?: boolean
  commonStyle?: {
    playedColor?: string
  }
  download?: boolean
  plugins?: unknown[]
  presets?: unknown[]
  url?: string
}

type MockPlayer = {
  destroy: ReturnType<typeof rstest.fn>
  handlers: Map<string, (...args: unknown[]) => void>
  off: ReturnType<typeof rstest.fn>
  on: ReturnType<typeof rstest.fn>
  video: {
    currentTime: number
    pause: ReturnType<typeof rstest.fn>
  }
}

const playerMock = rstest.hoisted(() => ({
  constructorShouldThrow: false,
  instances: [] as MockPlayer[],
  options: [] as PlayerOptions[],
}))

const HlsPlugin = class HlsPlugin {}
const Mp4Plugin = class Mp4Plugin {}

rstest.mock('xgplayer', () => {
  class DefaultPreset {
    plugins: unknown[] = []
    ignores: string[] = []
  }

  class SimplePlayer {
    destroy = rstest.fn()
    handlers = new Map<string, (...args: unknown[]) => void>()
    off = rstest.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (this.handlers.get(event) === handler) {
        this.handlers.delete(event)
      }
    })
    on = rstest.fn((event: string, handler: (...args: unknown[]) => void) => {
      this.handlers.set(event, handler)
    })
    video = {
      currentTime: 18,
      pause: rstest.fn(),
    }

    constructor(options: PlayerOptions) {
      if (playerMock.constructorShouldThrow) {
        throw new Error('constructor failed')
      }
      playerMock.options.push(options)
      playerMock.instances.push(this)
    }
  }

  return {
    DefaultPreset,
    Events: {
      ERROR: 'error',
    },
    I18N: {
      use: rstest.fn(),
    },
    SimplePlayer,
    langZhCn: {},
  }
})

rstest.mock('xgplayer-hls', () => ({
  default: HlsPlugin,
  HlsPlugin,
}))

rstest.mock('xgplayer-mp4', () => ({
  default: Mp4Plugin,
}))

const originalCanPlayType = HTMLMediaElement.prototype.canPlayType

beforeEach(() => {
  playerMock.constructorShouldThrow = false
  playerMock.instances.length = 0
  playerMock.options.length = 0
  HTMLMediaElement.prototype.canPlayType = () => ''
})

afterEach(() => {
  HTMLMediaElement.prototype.canPlayType = originalCanPlayType
})

describe('VideoPlayer', () => {
  it('uses the MP4 plugin without autoplay or a duplicate download action', async () => {
    render(
      <VideoPlayer
        source="/videos/lesson.MOV?token=1"
        sourceKind="mp4"
        primaryColor="#1677ff"
        onError={() => undefined}
      />
    )

    await waitFor(() => expect(playerMock.options).toHaveLength(1))

    expect(playerMock.options[0]).toMatchObject({
      autoplay: false,
      download: false,
      plugins: [Mp4Plugin],
      url: '/videos/lesson.MOV?token=1',
      commonStyle: {
        playedColor: '#1677ff',
      },
    })
    expect(playerMock.options[0]?.presets).toHaveLength(1)
  })

  it('uses native HLS when available and otherwise installs the HLS plugin', async () => {
    HTMLMediaElement.prototype.canPlayType = () => 'probably'
    const nativeView = render(
      <VideoPlayer
        source="/videos/live.m3u8"
        sourceKind="hls"
        primaryColor="#1677ff"
        onError={() => undefined}
      />
    )

    await waitFor(() => expect(playerMock.options).toHaveLength(1))
    expect(playerMock.options[0]?.plugins).toBeUndefined()

    nativeView.unmount()
    HTMLMediaElement.prototype.canPlayType = () => ''
    render(
      <VideoPlayer
        source="/videos/fallback.m3u8"
        sourceKind="hls"
        primaryColor="#1677ff"
        onError={() => undefined}
      />
    )

    await waitFor(() => expect(playerMock.options).toHaveLength(2))
    expect(playerMock.options[1]?.plugins).toEqual([HlsPlugin])
  })

  it('reports construction and media failures through the current callback', async () => {
    const onError = rstest.fn()
    playerMock.constructorShouldThrow = true
    const view = render(
      <VideoPlayer
        source="/videos/broken.mp4"
        sourceKind="mp4"
        primaryColor="#1677ff"
        onError={onError}
      />
    )

    await waitFor(() => expect(onError).toHaveBeenCalledWith('视频预览加载失败'))

    playerMock.constructorShouldThrow = false
    view.rerender(
      <VideoPlayer
        source="/videos/media-error.mp4"
        sourceKind="mp4"
        primaryColor="#1677ff"
        onError={onError}
      />
    )
    await waitFor(() => expect(playerMock.instances).toHaveLength(1))

    playerMock.instances[0]?.handlers.get('error')?.()
    expect(onError).toHaveBeenLastCalledWith('视频预览加载失败')
  })

  it('pauses, resets, and destroys the current instance on source change and unmount', async () => {
    const view = render(
      <VideoPlayer
        source="/videos/first.mp4"
        sourceKind="mp4"
        primaryColor="#1677ff"
        onError={() => undefined}
      />
    )
    await waitFor(() => expect(playerMock.instances).toHaveLength(1))
    const firstPlayer = playerMock.instances[0]

    view.rerender(
      <VideoPlayer
        source="/videos/second.m4v"
        sourceKind="mp4"
        primaryColor="#1677ff"
        onError={() => undefined}
      />
    )
    await waitFor(() => expect(playerMock.instances).toHaveLength(2))

    expect(firstPlayer?.video.pause).toHaveBeenCalledTimes(1)
    expect(firstPlayer?.video.currentTime).toBe(0)
    expect(firstPlayer?.destroy).toHaveBeenCalledTimes(1)

    const secondPlayer = playerMock.instances[1]
    view.unmount()

    expect(secondPlayer?.video.pause).toHaveBeenCalledTimes(1)
    expect(secondPlayer?.video.currentTime).toBe(0)
    expect(secondPlayer?.destroy).toHaveBeenCalledTimes(1)
  })
})
