import React, { useState } from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'

import { renderInLocale } from '../../test/render-in-locale'
import { ContentMediaSelect } from './content-media-select'

void React

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
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
  it('searches the server for older media and keeps its selected label after another search', async () => {
    const queries: string[] = []
    server.use(
      http.get('*/admin/settings/store-identity/media', ({ request }) => {
        const query = new URL(request.url).searchParams.get('query') ?? ''
        queries.push(query)
        if (query === 'Broken')
          return HttpResponse.json(
            { error: { code: 'private_failure', message: 'Private server prose' } },
            { status: 503 }
          )
        return HttpResponse.json({
          data:
            query === 'Archive'
              ? [{ id: 'media.archive', productName: 'Archive', alt: 'Brand logo' }]
              : Array.from({ length: 100 }, (_, index) => ({
                  id: `media.${index}`,
                  productName: 'Recent',
                  alt: `Image ${index}`,
                })),
        })
      })
    )
    const Controlled = () => {
      const [value, setValue] = useState<string>()
      return <ContentMediaSelect source="identity" value={value} onChange={setValue} />
    }
    renderInLocale(<Controlled />, 'en-US')
    await waitFor(() => expect(queries).toEqual(['']))
    const input = screen.getByRole('combobox')
    fireEvent.mouseDown(input)
    fireEvent.change(input, { target: { value: 'Archived' } })
    fireEvent.change(input, { target: { value: 'Archive' } })
    fireEvent.click(await screen.findByText('Archive · Brand logo'))
    fireEvent.change(input, { target: { value: 'Recent' } })
    await waitFor(() => expect(queries).toEqual(['', 'Archive', 'Recent']))
    await waitFor(() =>
      expect(input.closest('.ant-select')?.textContent).toContain('Archive · Brand logo')
    )
    fireEvent.change(input, { target: { value: 'Broken' } })
    expect(await screen.findByText('Media could not be loaded')).toBeTruthy()
    expect(screen.queryByText('Private server prose')).toBeNull()
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape', keyCode: 27 })
    fireEvent.mouseDown(input)
    await waitFor(() => expect(queries).toEqual(['', 'Archive', 'Recent', 'Broken', '']))
    await waitFor(() => expect(screen.queryByText('Media could not be loaded')).toBeNull())
    expect(input.closest('.ant-select')?.textContent).toContain('Archive · Brand logo')
  })

  it('loads a later matching page while scrolling the media popup', async () => {
    const pages: string[] = []
    let selected: string | undefined
    server.use(
      http.get('*/admin/catalog/collections/media', ({ request }) => {
        const page = new URL(request.url).searchParams.get('page') ?? '1'
        pages.push(page)
        return HttpResponse.json({
          data:
            page === '1'
              ? [{ id: 'media.first', productName: 'Recent', alt: 'Cover' }]
              : page === '2'
                ? [{ id: 'media.older', productName: 'Archive', alt: 'Cover' }]
                : [],
        })
      })
    )
    renderInLocale(
      <ContentMediaSelect
        source="collection"
        onChange={(value) => {
          selected = value
        }}
      />,
      'en-US'
    )
    fireEvent.mouseDown(screen.getByRole('combobox'))
    expect(await screen.findByText('Recent · Cover')).toBeTruthy()
    const scroll = document.querySelector('.rc-virtual-list-holder') as HTMLElement
    fireEvent.scroll(scroll)
    fireEvent.click(await screen.findByText('Archive · Cover'))
    expect(selected).toBe('media.older')
    expect(pages).toEqual(['1', '2'])
  })

  for (const [source, path] of [
    ['identity', '/admin/settings/store-identity/media'],
    ['collection', '/admin/catalog/collections/media'],
  ] as const) {
    it(`uses the ${source} endpoint and returns the stable selected ID`, async () => {
      let selected: string | undefined
      server.use(
        http.get(`*${path}`, () =>
          HttpResponse.json({
            data: [
              {
                id: 'media.logo',
                alt: 'Logo',
                productName: 'Brand',
                height: 80,
                width: 80,
                src: 'https://media.example.test/logo.png',
              },
            ],
          })
        )
      )
      renderInLocale(
        <ContentMediaSelect
          source={source}
          onChange={(value) => {
            selected = value
          }}
        />
      )
      await waitFor(() =>
        expect(screen.getByRole('combobox').getAttribute('aria-busy')).not.toBe('true')
      )
      fireEvent.mouseDown(screen.getByRole('combobox'))
      fireEvent.click(await screen.findByText('Brand · Logo'))
      expect(selected).toBe('media.logo')
      expect(requests).toBe(0)
    })
  }

  it('distinguishes failure from an empty result and retries with localized safe guidance', async () => {
    renderInLocale(<ContentMediaSelect />, 'en-US')
    expect(await screen.findByText('Media could not be loaded')).toBeTruthy()
    expect(screen.getByText('Request failed. Please try again later.')).toBeTruthy()
    expect(screen.queryByText('Private server prose')).toBeNull()
    fireEvent.mouseDown(screen.getByRole('combobox'))
    const retry = await screen.findByRole('button', { name: 'Retry loading' })
    failed = false
    fireEvent.click(retry)
    await waitFor(() => expect(requests).toBe(3))
    expect(await screen.findByText('Published product · Lookbook image')).toBeTruthy()
    expect(screen.queryByText('Media could not be loaded')).toBeNull()
  })
})
