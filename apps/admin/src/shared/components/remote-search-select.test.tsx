import React, { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { RemoteSearchSelect, type RemoteSearchSelectOption } from './remote-search-select'

void React

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })
}

if (!window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
}

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })

  return { promise, reject, resolve }
}

const waitForSearchDebounce = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350))
  })
}

const getOptionLabels = () =>
  Array.from(document.querySelectorAll('.ant-select-item-option-content')).map(
    (element) => element.textContent
  )

const expectArrayValueSearchOptions = async (mode: 'multiple' | 'tags') => {
  render(
    <RemoteSearchSelect
      open
      mode={mode}
      value={['selected-1', 'selected-2']}
      defaultOptions={[
        { label: '已选项一', value: 'selected-1' },
        { label: '已选项二', value: 'selected-2' },
        { label: '无关默认项', value: 'unrelated' },
      ]}
      fetchOptions={async () => [{ label: '远程匹配项', value: 'remote' }]}
      loadOnMount={false}
    />
  )

  fireEvent.change(screen.getByRole('combobox'), { target: { value: '匹配' } })
  await waitForSearchDebounce()
  await screen.findByText('远程匹配项')

  const optionLabels = getOptionLabels()
  expect(optionLabels).toContain('已选项一')
  expect(optionLabels).toContain('已选项二')
  expect(optionLabels).toContain('远程匹配项')
  expect(optionLabels).not.toContain('无关默认项')
}

describe('RemoteSearchSelect', () => {
  it('reloads empty-keyword options when clear is clicked', async () => {
    const requestLog: Array<[string, number | undefined]> = []

    const fetchOptions = async (keyword: string, current?: number) => {
      requestLog.push([keyword, current])

      if (keyword) {
        return [{ label: `(${keyword})搜索结果`, value: 2 }]
      }

      return [{ label: '(1)基础课程', value: 1 }]
    }

    const Wrapper = () => {
      const [value, setValue] = useState<number | undefined>(1)

      return (
        <RemoteSearchSelect
          value={value}
          onChange={(nextValue) => setValue(nextValue as number | undefined)}
          defaultOptions={[{ label: '(1)基础课程', value: 1 }]}
          fetchOptions={fetchOptions}
          loadOnMount={false}
        />
      )
    }

    const { container } = render(<Wrapper />)

    const clearTrigger = container.querySelector('.ant-select-clear')
    expect(clearTrigger).toBeTruthy()

    fireEvent.mouseDown(clearTrigger as HTMLElement)
    fireEvent.click(clearTrigger as HTMLElement)

    await waitFor(() => {
      expect(requestLog).toContainEqual(['', 1])
    })
  })

  it('ignores stale search results when an older request resolves last', async () => {
    const requests = new Map<string, Deferred<RemoteSearchSelectOption[]>>()

    const fetchOptions = (keyword: string) => {
      const deferred = createDeferred<RemoteSearchSelectOption[]>()
      requests.set(keyword, deferred)
      return deferred.promise
    }

    render(<RemoteSearchSelect open fetchOptions={fetchOptions} loadOnMount={false} />)

    const input = screen.getByRole('combobox')

    fireEvent.change(input, { target: { value: 'old' } })
    await waitForSearchDebounce()

    await waitFor(() => {
      expect(requests.has('old')).toBe(true)
    })

    fireEvent.change(input, { target: { value: 'new' } })
    await waitForSearchDebounce()

    await waitFor(() => {
      expect(requests.has('new')).toBe(true)
    })

    const newRequest = requests.get('new')
    expect(newRequest).toBeTruthy()
    await act(async () => {
      newRequest?.resolve([{ label: 'new result', value: 2 }])
      await newRequest?.promise
    })

    await waitFor(() => {
      expect(screen.getByText('new result')).toBeTruthy()
    })

    const oldRequest = requests.get('old')
    expect(oldRequest).toBeTruthy()
    await act(async () => {
      oldRequest?.resolve([{ label: 'old result', value: 1 }])
      await oldRequest?.promise
    })

    expect(screen.getByText('new result')).toBeTruthy()
    expect(screen.queryByText('old result')).toBeNull()
  })

  it('ignores a stale search failure after a newer request succeeds', async () => {
    const requests = new Map<string, Deferred<RemoteSearchSelectOption[]>>()
    const errors: unknown[] = []
    render(
      <RemoteSearchSelect
        open
        loadOnMount={false}
        fetchOptions={(keyword) => {
          const deferred = createDeferred<RemoteSearchSelectOption[]>()
          requests.set(keyword, deferred)
          return deferred.promise
        }}
        onFetchError={(error) => errors.push(error)}
      />
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'old' } })
    await waitForSearchDebounce()
    await waitFor(() => expect(requests.has('old')).toBe(true))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'new' } })
    await waitForSearchDebounce()
    await waitFor(() => expect(requests.has('new')).toBe(true))

    await act(async () => {
      requests.get('new')?.resolve([{ label: 'new result', value: 2 }])
      await requests.get('new')?.promise
    })
    await act(async () => {
      requests.get('old')?.reject(new Error('stale failure'))
      await requests.get('old')?.promise.catch(() => undefined)
    })

    expect(await screen.findByText('new result')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '重试加载' })).toBeNull()
    expect(errors).toEqual([])
  })

  it('loads later pages, merges options, and stops after an empty page', async () => {
    const requestedPages: number[] = []
    render(
      <RemoteSearchSelect
        open
        fetchOptions={async (_, page = 1) => {
          requestedPages.push(page)
          if (page === 1) return [{ label: '第一页', value: 1 }]
          if (page === 2) return [{ label: '第二页', value: 2 }]
          return []
        }}
      />
    )

    expect(await screen.findByText('第一页')).toBeTruthy()
    const scrollHolder = Array.from(
      document.querySelectorAll<HTMLDivElement>('.rc-virtual-list-holder')
    ).at(-1) as HTMLDivElement

    fireEvent.scroll(scrollHolder)
    expect(await screen.findByText('第二页')).toBeTruthy()
    expect(screen.getByText('第一页')).toBeTruthy()
    fireEvent.scroll(scrollHolder)
    await waitFor(() => expect(requestedPages).toEqual([1, 2, 3]))
    fireEvent.scroll(scrollHolder)
    await act(async () => {
      await Promise.resolve()
    })
    expect(requestedPages).toEqual([1, 2, 3])
  })

  it('keeps remote search active after StrictMode remounts the component', async () => {
    const requestLog: string[] = []

    const fetchOptions = async (keyword: string) => {
      requestLog.push(keyword)
      return [{ label: `${keyword} result`, value: 1 }]
    }

    render(
      <React.StrictMode>
        <RemoteSearchSelect fetchOptions={fetchOptions} loadOnMount={false} />
      </React.StrictMode>
    )

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'strict' },
    })
    await waitForSearchDebounce()

    await waitFor(() => {
      expect(requestLog).toContain('strict')
    })
  })

  it('uses the latest fetch callback without reloading when callback identity changes', async () => {
    const firstCalls: string[] = []
    const secondCalls: string[] = []
    const { rerender } = render(
      <RemoteSearchSelect
        fetchOptions={async (keyword) => {
          firstCalls.push(keyword)
          return []
        }}
      />
    )
    await waitFor(() => expect(firstCalls).toEqual(['']))

    rerender(
      <RemoteSearchSelect
        fetchOptions={async (keyword) => {
          secondCalls.push(keyword)
          return []
        }}
      />
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(secondCalls).toEqual([])

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'latest' } })
    await waitForSearchDebounce()
    await waitFor(() => expect(secondCalls).toEqual(['latest']))
  })

  it('shows a focusable retry action and retries the failed page', async () => {
    let attempts = 0
    render(
      <RemoteSearchSelect
        open
        fetchOptions={async () => {
          attempts += 1
          if (attempts === 1) {
            throw new Error('network down')
          }
          return [{ label: '重试成功', value: 1 }]
        }}
      />
    )

    const retryButton = await screen.findByRole('button', { name: '重试加载' })
    retryButton.focus()
    expect(document.activeElement).toBe(retryButton)
    fireEvent.click(retryButton)

    expect(await screen.findByText('重试成功')).toBeTruthy()
    expect(attempts).toBe(2)
  })

  it('composes external search and popup scroll handlers', async () => {
    const searches: string[] = []
    let scrollCount = 0
    render(
      <RemoteSearchSelect
        open
        loadOnMount={false}
        defaultOptions={[{ label: '初始选项', value: 1 }]}
        fetchOptions={async () => [{ label: '远程选项', value: 2 }]}
        showSearch={{ onSearch: (keyword) => searches.push(keyword) }}
        onPopupScroll={() => {
          scrollCount += 1
        }}
      />
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '组合' } })
    await waitForSearchDebounce()
    expect(searches).toContain('组合')
    expect(await screen.findByText('远程选项')).toBeTruthy()

    const scrollHolder = Array.from(
      document.querySelectorAll<HTMLDivElement>('.rc-virtual-list-holder')
    ).at(-1)
    expect(scrollHolder).toBeTruthy()
    fireEvent.scroll(scrollHolder as HTMLDivElement)
    expect(scrollCount).toBe(1)
  })

  it('supports explicitly string-valued options', async () => {
    const changes: string[] = []
    render(
      <RemoteSearchSelect<unknown, string>
        open
        defaultOptions={[{ label: '字符串选项', value: 'string-id' }]}
        fetchOptions={async () => []}
        loadOnMount={false}
        onChange={(value) => changes.push(value)}
      />
    )

    fireEvent.click(await screen.findByText('字符串选项'))
    expect(changes).toEqual(['string-id'])
  })

  it('supports multiple selection with array-valued change callbacks', async () => {
    const changes: number[][] = []
    render(
      <RemoteSearchSelect
        open
        mode="multiple"
        defaultOptions={[
          { label: '选项一', value: 1 },
          { label: '选项二', value: 2 },
        ]}
        fetchOptions={async () => []}
        loadOnMount={false}
        onChange={(values) => changes.push(values)}
      />
    )

    fireEvent.click(await screen.findByText('选项一'))
    fireEvent.click(await screen.findByText('选项二'))
    expect(changes.at(-1)).toEqual([1, 2])
  })

  it('loads on first open, composes open changes, and keeps default options', async () => {
    const openChanges: boolean[] = []
    const fetchCalls: string[] = []
    const { rerender } = render(
      <RemoteSearchSelect
        defaultOptions={[{ label: '已选默认项', value: 99 }]}
        fetchOptions={async (keyword) => {
          fetchCalls.push(keyword)
          return [{ label: '远程首屏项', value: 1 }]
        }}
        loadOnMount={false}
        loadOnOpen
        onOpenChange={(open) => openChanges.push(open)}
      />
    )

    fireEvent.mouseDown(screen.getByRole('combobox'))
    expect(await screen.findByText('远程首屏项')).toBeTruthy()
    expect(screen.getByText('已选默认项')).toBeTruthy()
    expect(fetchCalls).toEqual([''])
    expect(openChanges).toContain(true)

    rerender(
      <RemoteSearchSelect
        open
        defaultOptions={[{ label: '更新后的默认项', value: 100 }]}
        fetchOptions={async () => []}
        loadOnMount={false}
      />
    )
    expect(await screen.findByText('更新后的默认项')).toBeTruthy()
  })

  it('replaces unrelated default options while preserving the selected option during search', async () => {
    render(
      <RemoteSearchSelect
        open
        value={99}
        defaultOptions={[
          { label: '已选默认项', value: 99 },
          { label: '无关默认项', value: 2 },
        ]}
        fetchOptions={async (keyword) => (keyword ? [{ label: '匹配搜索项', value: 1 }] : [])}
        loadOnMount={false}
      />
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '匹配' } })
    await waitForSearchDebounce()
    await screen.findByText('匹配搜索项')

    const optionLabels = getOptionLabels()
    expect(optionLabels).toContain('匹配搜索项')
    expect(optionLabels).toContain('已选默认项')
    expect(optionLabels).not.toContain('无关默认项')
  })

  it('preserves an uncontrolled default value option during search', async () => {
    render(
      <RemoteSearchSelect
        open
        defaultValue={99}
        defaultOptions={[
          { label: '非受控已选项', value: 99 },
          { label: '非受控无关项', value: 2 },
        ]}
        fetchOptions={async () => [{ label: '非受控搜索结果', value: 1 }]}
        loadOnMount={false}
      />
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '匹配' } })
    await waitForSearchDebounce()
    await screen.findByText('非受控搜索结果')

    expect(screen.getByRole('combobox').parentElement?.getAttribute('title')).toBe('非受控已选项')
    expect(getOptionLabels()).toContain('非受控已选项')
    expect(getOptionLabels()).not.toContain('非受控无关项')
  })

  it('restores a default option label when the controlled value changes during search', async () => {
    const defaultOptions = [
      { label: '默认项一', value: 1 },
      { label: '默认项二', value: 2 },
    ]
    const fetchOptions = async () => [{ label: '匹配搜索项', value: 3 }]
    const { rerender } = render(
      <RemoteSearchSelect
        open
        value={1}
        defaultOptions={defaultOptions}
        fetchOptions={fetchOptions}
        loadOnMount={false}
      />
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '匹配' } })
    await waitForSearchDebounce()
    await screen.findByText('匹配搜索项')
    expect(getOptionLabels()).not.toContain('默认项二')

    rerender(
      <RemoteSearchSelect
        open
        value={2}
        defaultOptions={defaultOptions}
        fetchOptions={fetchOptions}
        loadOnMount={false}
      />
    )
    await waitFor(() =>
      expect(screen.getByRole('combobox').parentElement?.getAttribute('title')).toBe('默认项二')
    )
  })

  it('keeps the actual controlled option when the parent rejects a proposed change', async () => {
    const changes: number[] = []
    render(
      <RemoteSearchSelect
        open
        value={1}
        defaultOptions={[{ label: '父层实际选中项', value: 1 }]}
        fetchOptions={async (keyword) => [
          keyword === '第一次'
            ? { label: '父层未接受项', value: 2 }
            : { label: '第二次搜索项', value: 3 },
        ]}
        loadOnMount={false}
        onChange={(nextValue) => changes.push(nextValue)}
      />
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '第一次' } })
    await waitForSearchDebounce()
    fireEvent.click(await screen.findByText('父层未接受项'))
    expect(changes).toEqual([2])

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '第二次' } })
    await waitForSearchDebounce()
    await screen.findByText('第二次搜索项')

    expect(getOptionLabels()).toContain('父层实际选中项')
    expect(getOptionLabels()).not.toContain('父层未接受项')
  })

  it('refreshes a selected default option label during a non-empty search', async () => {
    const fetchOptions = async () => [{ label: '远程匹配项', value: 2 }]
    const { rerender } = render(
      <RemoteSearchSelect
        open
        value={1}
        defaultOptions={[{ label: '旧默认标签', value: 1 }]}
        fetchOptions={fetchOptions}
        loadOnMount={false}
      />
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '匹配' } })
    await waitForSearchDebounce()
    await screen.findByText('远程匹配项')

    rerender(
      <RemoteSearchSelect
        open
        value={1}
        defaultOptions={[{ label: '新默认标签', value: 1 }]}
        fetchOptions={fetchOptions}
        loadOnMount={false}
      />
    )

    await waitFor(() => expect(getOptionLabels()).toContain('新默认标签'))
    expect(getOptionLabels()).not.toContain('旧默认标签')
  })

  it('restores a previously loaded option label after later searches replace it', async () => {
    const fetchOptions = async (keyword: string) => [
      keyword === '第一次' ? { label: '首次远程项', value: 2 } : { label: '后续远程项', value: 3 },
    ]
    const { rerender } = render(
      <RemoteSearchSelect
        open
        value={1}
        defaultOptions={[{ label: '默认项', value: 1 }]}
        fetchOptions={fetchOptions}
        loadOnMount={false}
      />
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '第一次' } })
    await waitForSearchDebounce()
    await screen.findByText('首次远程项')

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '第二次' } })
    await waitForSearchDebounce()
    await screen.findByText('后续远程项')

    rerender(
      <RemoteSearchSelect
        open
        value={2}
        defaultOptions={[{ label: '默认项', value: 1 }]}
        fetchOptions={fetchOptions}
        loadOnMount={false}
      />
    )
    await waitFor(() =>
      expect(screen.getByRole('combobox').parentElement?.getAttribute('title')).toBe('首次远程项')
    )
  })

  it('keeps the selected remote option label when search is cleared', async () => {
    const fetchOptions = async (keyword: string) =>
      keyword ? [{ label: '历史远程项', value: 2 }] : [{ label: '空关键词远程项', value: 3 }]
    const { rerender } = render(
      <RemoteSearchSelect
        open
        value={1}
        defaultOptions={[{ label: '默认项', value: 1 }]}
        fetchOptions={fetchOptions}
        loadOnMount={false}
      />
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '历史' } })
    await waitForSearchDebounce()
    await screen.findByText('历史远程项')

    rerender(
      <RemoteSearchSelect
        open
        value={2}
        defaultOptions={[{ label: '默认项', value: 1 }]}
        fetchOptions={fetchOptions}
        loadOnMount={false}
      />
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
    await waitForSearchDebounce()
    await screen.findByText('空关键词远程项')

    expect(screen.getByRole('combobox').parentElement?.getAttribute('title')).toBe('历史远程项')
    expect(getOptionLabels()).toContain('历史远程项')
    expect(getOptionLabels()).toContain('默认项')
  })

  it('does not expose unrelated defaults added during a non-empty search', async () => {
    const fetchOptions = async () => [{ label: '远程匹配项', value: 3 }]
    const { rerender } = render(
      <RemoteSearchSelect
        open
        value={1}
        defaultOptions={[{ label: '已选默认项', value: 1 }]}
        fetchOptions={fetchOptions}
        loadOnMount={false}
      />
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '匹配' } })
    await waitForSearchDebounce()
    await screen.findByText('远程匹配项')

    rerender(
      <RemoteSearchSelect
        open
        value={5}
        defaultOptions={[
          { label: '动态已选默认项', value: 5 },
          { label: '动态无关默认项', value: 4 },
        ]}
        fetchOptions={fetchOptions}
        loadOnMount={false}
      />
    )

    await waitFor(() =>
      expect(screen.getByRole('combobox').parentElement?.getAttribute('title')).toBe(
        '动态已选默认项'
      )
    )
    expect(getOptionLabels()).not.toContain('动态无关默认项')
    expect(getOptionLabels()).toContain('动态已选默认项')
    expect(getOptionLabels()).toContain('远程匹配项')
  })

  it('preserves every selected option during multiple-mode search', async () => {
    await expectArrayValueSearchOptions('multiple')
  })

  it('preserves every selected option during tags-mode search', async () => {
    await expectArrayValueSearchOptions('tags')
  })

  it('does not retain a proposed option when a controlled undefined value rejects it', async () => {
    const changes: number[] = []
    render(
      <RemoteSearchSelect<unknown, number>
        open
        value={undefined}
        loadOnMount={false}
        onChange={(value) => changes.push(value)}
        fetchOptions={async (keyword) => [
          keyword === 'first'
            ? { label: 'Rejected selection', value: 1 }
            : { label: 'Next result', value: 2 },
        ]}
      />
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'first' } })
    await waitForSearchDebounce()
    fireEvent.click(await screen.findByText('Rejected selection'))
    expect(changes).toEqual([1])
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'next' } })
    await waitForSearchDebounce()
    await screen.findByText('Next result')
    expect(getOptionLabels()).not.toContain('Rejected selection')
  })

  it.each([undefined, 'multiple', 'tags'] as const)(
    'retains an uncontrolled remote selection across searches and removes it on clear in %s mode',
    async (mode) => {
      const { container } = render(
        <RemoteSearchSelect
          open
          mode={mode}
          loadOnMount={false}
          fetchOptions={async (keyword) =>
            keyword === 'first'
              ? [{ label: 'Selected remote result', value: 'selected' }]
              : [{ label: 'Replacement result', value: 'replacement' }]
          }
        />
      )

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'first' } })
      await waitForSearchDebounce()
      fireEvent.click(await screen.findByText('Selected remote result'))
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'next' } })
      await waitForSearchDebounce()
      await screen.findByText('Replacement result')
      expect(getOptionLabels()).toContain('Selected remote result')

      const clear = container.querySelector('.ant-select-clear') as HTMLElement
      expect(clear).toBeTruthy()
      fireEvent.mouseDown(clear)
      fireEvent.click(clear)
      await waitFor(() => expect(getOptionLabels()).not.toContain('Selected remote result'))
    }
  )

  it('renders custom empty content and composes external loading state', async () => {
    const { container } = render(
      <RemoteSearchSelect
        open
        emptyContent={<button type="button">创建选项</button>}
        fetchOptions={async () => []}
        loadOnMount={false}
        loading
      />
    )

    expect(await screen.findByRole('button', { name: '创建选项' })).toBeTruthy()
    expect(container.querySelector('.ant-select-loading')).toBeTruthy()
  })
})
