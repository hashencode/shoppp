import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'

import { renderInLocale } from '../../test/render-in-locale'
import { ContentMediaSelect } from './content-media-select'

void React

if (!window.ResizeObserver) {
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
}

let failed = true
let requests = 0
const server = setupServer(
  http.get('*/admin/content/media', () => {
    requests += 1
    if (failed) {
      return HttpResponse.json(
        { error: { code: 'private_failure', message: 'Private server prose' } },
        { status: 503 }
      )
    }
    return HttpResponse.json({
      data: [
        {
          alt: 'Lookbook image',
          height: 800,
          id: 'media.lookbook',
          key: 'catalog/lookbook.webp',
          kind: 'catalog',
          productName: 'Published product',
          src: 'https://media.example.test/catalog/lookbook.webp',
          width: 600,
        },
      ],
      meta: { total: 1 },
    })
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  failed = true
  requests = 0
  server.resetHandlers()
})
afterAll(() => server.close())

describe('ContentMediaSelect', () => {
  it('distinguishes failure from an empty result and retries with localized safe guidance', async () => {
    renderInLocale(<ContentMediaSelect />, 'en-US')
    expect(await screen.findByText('Media could not be loaded')).toBeTruthy()
    expect(screen.getByText('Request failed. Please try again later.')).toBeTruthy()
    expect(screen.queryByText('Private server prose')).toBeNull()
    failed = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(requests).toBe(2))
    fireEvent.mouseDown(screen.getByRole('combobox'))
    expect(await screen.findByText('Published product · Lookbook image')).toBeTruthy()
    expect(screen.queryByText('Media could not be loaded')).toBeNull()
  })
})
