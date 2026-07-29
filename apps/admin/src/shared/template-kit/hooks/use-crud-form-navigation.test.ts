import { describe, expect, it } from '@rstest/core'
import { closeWindowWithFallback, goBackOrCloseWindow } from './use-crud-form-navigation'

type TestWindow = NonNullable<Parameters<typeof goBackOrCloseWindow>[1]>

const runImmediately = ((handler: TimerHandler) => {
  if (typeof handler === 'function') {
    handler()
  }

  return 0
}) as Window['setTimeout']

const createTestWindow = ({
  historyLength,
  closed = false,
}: {
  historyLength: number
  closed?: boolean
}) => {
  const calls = {
    close: 0,
    back: 0,
    assignedPath: '',
  }
  const state = {
    closed,
  }

  const targetWindow: TestWindow = {
    get closed() {
      return state.closed
    },
    close: () => {
      calls.close += 1
    },
    setTimeout: runImmediately,
    history: {
      length: historyLength,
      back: () => {
        calls.back += 1
      },
    },
    location: {
      assign: (url) => {
        calls.assignedPath = String(url)
      },
    },
  }

  return {
    calls,
    state,
    targetWindow,
  }
}

describe('crud form window navigation', () => {
  it('goes back when the current page has browser history', () => {
    const { calls, targetWindow } = createTestWindow({ historyLength: 2 })

    goBackOrCloseWindow('/fallback-list', targetWindow)

    expect(calls.back).toBe(1)
    expect(calls.close).toBe(0)
    expect(calls.assignedPath).toBe('')
  })

  it('closes standalone pages and falls back to list when close is blocked', () => {
    const { calls, targetWindow } = createTestWindow({ historyLength: 1 })

    goBackOrCloseWindow('/fallback-list', targetWindow)

    expect(calls.close).toBe(1)
    expect(calls.back).toBe(0)
    expect(calls.assignedPath).toBe('/fallback-list')
  })

  it('prefixes fallback paths when an app base is configured', () => {
    const { calls, targetWindow } = createTestWindow({ historyLength: 1 })
    goBackOrCloseWindow('/users', targetWindow, '/admin')
    expect(calls.assignedPath).toBe('/admin/users')
  })

  it('does not fallback after the current window has closed', () => {
    const { calls, state, targetWindow } = createTestWindow({ historyLength: 1 })
    targetWindow.close = () => {
      calls.close += 1
      state.closed = true
    }

    closeWindowWithFallback('/fallback-list', targetWindow)

    expect(calls.close).toBe(1)
    expect(calls.back).toBe(0)
    expect(calls.assignedPath).toBe('')
  })
})
