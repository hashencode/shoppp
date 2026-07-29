import { setupWorker } from 'msw/browser'
import { templateHandlers } from './handlers/template-handlers'

const worker = setupWorker(...templateHandlers)
let workerStartPromise: Promise<void> | null = null
let started = false

export const enableMocking = async () => {
  if (started) {
    return
  }

  if (!workerStartPromise) {
    workerStartPromise = worker
      .start({
        onUnhandledRequest: 'bypass',
      })
      .then(() => {
        started = true
      })
  }

  await workerStartPromise
}

export const disableMocking = () => {
  if (!started && !workerStartPromise) {
    return
  }

  worker.stop()
  started = false
  workerStartPromise = null
}

export const isMockingEnabled = () => started
