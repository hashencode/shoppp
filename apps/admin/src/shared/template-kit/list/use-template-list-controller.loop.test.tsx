import { render } from '../../../test/render-with-app'
import React from 'react'
import { useCallback, useEffect, useMemo } from 'react'
import { act, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { useTemplateListController } from './use-template-list-controller'

void React

type ProbeItem = {
  key: string
  name: string
}

type ProbeResponse = {
  data: ProbeItem[]
}

type ProbeFilters = {
  keyword?: string
}

type ProbeError = {
  message: string
}

type LoopProbeProps = {
  request: (filters: ProbeFilters) => Promise<ProbeResponse>
}

const LoopProbe = ({ request }: LoopProbeProps) => {
  const stableFilters = useMemo<ProbeFilters>(() => ({ keyword: 'demo' }), [])
  const stableTransformResponse = useCallback((nextResponse: ProbeResponse) => nextResponse, [])
  const { response, load } = useTemplateListController<
    ProbeFilters,
    ProbeResponse,
    ProbeItem,
    ProbeError
  >({
    filters: stableFilters,
    request,
    selectItems: (nextResponse) => nextResponse?.data ?? [],
    mapError: (error) => {
      void error
      return { message: 'mapped error' }
    },
    onError: (error, filters) => {
      void error
      void filters
    },
    transformResponse: stableTransformResponse,
  })

  useEffect(() => {
    void load()
  }, [load])

  return <div>rows:{response?.data.length ?? 0}</div>
}

describe('useTemplateListController loop guard', () => {
  it('does not trigger repeated requests after first successful load', async () => {
    let requestCallCount = 0
    const request = async (filters: ProbeFilters): Promise<ProbeResponse> => {
      void filters
      requestCallCount += 1
      return {
        data: [{ key: '1', name: 'row-1' }],
      }
    }

    render(<LoopProbe request={request} />)

    await waitFor(() => {
      expect(screen.getByText('rows:1')).toBeTruthy()
    })

    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 80)
      })
    })

    expect(requestCallCount).toBe(1)
  })
})
