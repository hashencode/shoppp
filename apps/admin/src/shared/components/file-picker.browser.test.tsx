import '../../index.css'

import React, { useState } from 'react'
import { Button, ConfigProvider, Upload, theme } from 'antd'
import type { UploadFile, UploadProps } from 'antd'
import { page } from '@rstest/browser'
import { afterEach, beforeEach, describe, expect, it, rstest } from '@rstest/core'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { render } from '../../test/render-with-app'
import { I18nProvider, useI18n, LANGUAGE_STORAGE_KEY } from '../contexts/i18n-context'
import { FilePicker, type FilePickerProps } from './file-picker'
import { ListExcelActions } from './list-excel-actions'

void React

type RequestOptions = Parameters<NonNullable<UploadProps['customRequest']>>[0]
let requests: Array<{ xhr: XMLHttpRequest; body: Document | XMLHttpRequestBodyInit | null }>

beforeEach(() => {
  requests = []
  rstest.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(function (
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null
  ) {
    requests.push({ xhr: this, body: body ?? null })
  })
  rstest.spyOn(window, 'fetch').mockRejectedValue(new Error('Unexpected file-picker request'))
})

afterEach(() => {
  cleanup()
  window.localStorage.removeItem(LANGUAGE_STORAGE_KEY)
  rstest.restoreAllMocks()
})

const inputOf = (container: Element) =>
  container.querySelector<HTMLInputElement>('input[type="file"]')!

const transferOf = (...files: File[]) => {
  const transfer = new DataTransfer()
  for (const file of files) transfer.items.add(file)
  return transfer
}

const selectFiles = (container: Element, ...files: File[]) => {
  const input = inputOf(container)
  input.files = transferOf(...files).files
  fireEvent.change(input)
}

const dropFiles = (container: Element, ...files: File[]) =>
  act(async () => {
    inputOf(container)
      .closest('.ant-upload-btn')!
      .dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transferOf(...files) }))
  })

const openImport = async () => {
  await page.getByRole('button', { name: '数据导入', exact: true }).click()
  return screen.findByRole('dialog')
}

describe('FilePicker local Browser Mode', () => {
  it('should return source files after a trigger click and drop without sending requests', async () => {
    const changes: File[][] = []
    const Wrapper = () => {
      const [value, setValue] = useState<File[]>([])
      return (
        <FilePicker
          value={value}
          accept=".xlsx"
          onChange={(next) => {
            changes.push(next)
            setValue(next)
          }}
        />
      )
    }
    const { container } = render(<Wrapper />)
    const input = inputOf(container)
    const pickerClick = rstest.spyOn(input, 'click').mockImplementation(() => undefined)
    await page.getByText('点击或拖拽文件至此区域').click()
    expect(pickerClick).toHaveBeenCalledTimes(1)
    pickerClick.mockRestore()

    const selected = new File(['selected'], 'selected.xlsx')
    selectFiles(container, selected)
    await waitFor(() => expect(changes).toHaveLength(1))
    expect(changes[0][0]).toBe(selected)
    await expect.element(page.getByText('selected.xlsx')).toBeVisible()

    const dropped = new File(['dropped'], 'dropped.xlsx')
    await dropFiles(container, dropped)
    await waitFor(() => expect(changes).toHaveLength(2))
    expect(changes[1][0]).toBe(dropped)
    await expect.element(page.getByText('dropped.xlsx')).toBeVisible()
    expect(container.querySelector('.ant-upload-list-item-done')).toBeNull()
    expect(requests).toHaveLength(0)
    expect(window.fetch).not.toHaveBeenCalled()
  })

  it.each(['invalid-only', 'mixed'] as const)(
    'should reject a complete %s drop before changing the local selection',
    async (batch) => {
      const change = rstest.fn()
      const invalid = rstest.fn()
      const { container } = render(
        <FilePicker
          multiple
          maxCount={3}
          accept={batch === 'mixed' ? { format: '.xlsx' } : '.xlsx'}
          value={[new File(['kept'], 'kept.xlsx')]}
          onChange={change}
          onInvalid={invalid}
        />
      )
      const wrong = new File(['wrong'], 'wrong.csv')
      await dropFiles(
        container,
        ...(batch === 'mixed' ? [new File(['valid'], 'valid.xlsx'), wrong] : [wrong])
      )
      await waitFor(() => expect(invalid).toHaveBeenCalledTimes(1))
      expect(change).not.toHaveBeenCalled()
      expect(screen.getByRole('alert').textContent).toBe('文件格式不支持，请上传 .xlsx 格式文件。')
      expect(inputOf(container).accept).toBe('.xlsx')
      expect(screen.getByText('kept.xlsx')).toBeTruthy()
      expect(screen.queryByText('valid.xlsx')).toBeNull()
      expect(requests).toHaveLength(0)
      expect(window.fetch).not.toHaveBeenCalled()
    }
  )

  it.each([
    ['light', 720],
    ['dark', 720],
    ['light', 320],
    ['dark', 320],
  ] as const)(
    'should contain long names and retain associated invalid-replacement feedback in %s at %s px',
    async (mode, width) => {
      const fileName = '医院年度评审指标完整数据文件名称'.repeat(5) + '.xlsx'
      const Wrapper = () => {
        const [value, setValue] = useState([new File(['valid'], fileName)])
        return (
          <ConfigProvider
            theme={{
              algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
              token: { motion: false },
            }}
          >
            <div data-testid="picker-host" style={{ width }}>
              <FilePicker
                value={value}
                onChange={setValue}
                onInvalid={() => setValue([])}
                accept=".xlsx"
                uploadHint="支持 XLSX 文件"
              />
            </div>
          </ConfigProvider>
        )
      }
      const { container } = render(<Wrapper />)
      const host = screen.getByTestId('picker-host')
      await expect.element(page.getByText(fileName)).toBeVisible()
      expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth)
      const name = host.querySelector('.ant-upload-list-item-name')!
      expect(name.getBoundingClientRect().right).toBeLessThanOrEqual(
        host.getBoundingClientRect().right + 1
      )

      selectFiles(container, new File(['wrong'], 'invalid.txt'))
      const error = await screen.findByRole('alert')
      expect(error.textContent).toBe('文件格式不支持，请上传 .xlsx 格式文件。')
      await waitFor(() => expect(host.querySelector('.ant-upload-list-item')).toBeNull())
      expect(screen.getAllByRole('alert')).toHaveLength(1)
      expect(inputOf(host).getAttribute('aria-invalid')).toBe('true')
      const control = host.querySelector<HTMLElement>('.ant-upload-btn[role="button"]')!
      control.focus()
      expect(document.activeElement).toBe(control)
      expect(control.getAttribute('aria-describedby')?.split(' ')).toContain(error.id)
      expect(control.getAttribute('aria-invalid')).toBe('true')
      expect(inputOf(host).getAttribute('aria-describedby')?.split(' ')).toContain(error.id)
      expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth)
      expect(error.getBoundingClientRect().height).toBeGreaterThan(0)
      expect(window.getComputedStyle(error).color).not.toBe('rgba(0, 0, 0, 0)')

      selectFiles(container, new File(['valid again'], 'corrected.xlsx'))
      await expect.element(page.getByText('corrected.xlsx')).toBeVisible()
      expect(screen.queryByRole('alert')).toBeNull()
      expect(inputOf(host).getAttribute('aria-invalid')).not.toBe('true')
      expect(control.getAttribute('aria-invalid')).not.toBe('true')
      expect(control.getAttribute('aria-describedby') ?? '').not.toContain(error.id)
      expect(requests).toHaveLength(0)
    }
  )
})

describe('ListExcelActions native FilePicker Browser Mode', () => {
  it('should use default action transport and retain an uncontrolled default list', async () => {
    const opened = rstest.spyOn(XMLHttpRequest.prototype, 'open')
    const changes: Array<{ status: UploadFile['status']; name: string }> = []
    render(
      <ListExcelActions
        importAction={{
          uploadProps: {
            action: '/__file-picker-test__/upload',
            name: 'sheet',
            data: { year: '2026' },
            defaultFileList: [{ uid: 'existing', name: 'previous.xlsx', status: 'done' }],
            onChange: ({ file }) => changes.push({ status: file.status, name: file.name }),
          },
        }}
      />
    )
    const dialog = await openImport()
    selectFiles(dialog, new File(['synthetic workbook'], 'new.xlsx'))
    await waitFor(() => expect(requests).toHaveLength(1))
    expect(opened.mock.calls[0].slice(0, 2)).toEqual(['post', '/__file-picker-test__/upload'])
    const { xhr, body } = requests[0]
    expect(body).toBeInstanceOf(FormData)
    const form = body as FormData
    expect(form.get('year')).toBe('2026')
    expect((form.get('sheet') as File).name).toBe('new.xlsx')
    expect(await (form.get('sheet') as File).text()).toBe('synthetic workbook')
    expect(changes).toContainEqual({ status: 'uploading', name: 'new.xlsx' })

    await act(async () => {
      Object.defineProperties(xhr, {
        status: { value: 200, configurable: true },
        responseText: { value: '{"ok":true}', configurable: true },
      })
      xhr.dispatchEvent(new ProgressEvent('load'))
    })
    await waitFor(() => expect(changes).toContainEqual({ status: 'done', name: 'new.xlsx' }))
    expect(within(dialog).getByText('previous.xlsx')).toBeTruthy()
    expect(within(dialog).getByText('new.xlsx')).toBeTruthy()
    expect(dialog.querySelectorAll('.ant-upload-list-item')).toHaveLength(2)
    expect(window.fetch).not.toHaveBeenCalled()
  })

  it('should preserve the different false and LIST_IGNORE beforeUpload outcomes', async () => {
    const changes: string[] = []
    render(
      <ListExcelActions
        importAction={{
          uploadProps: {
            multiple: true,
            beforeUpload: (file) => (file.name === 'ignored.xlsx' ? Upload.LIST_IGNORE : false),
            onChange: ({ file }) => changes.push(file.name),
          },
        }}
      />
    )
    const dialog = await openImport()
    selectFiles(dialog, new File(['held'], 'held.xlsx'), new File(['ignored'], 'ignored.xlsx'))
    await within(dialog).findByText('held.xlsx')
    expect(within(dialog).queryByText('ignored.xlsx')).toBeNull()
    expect(changes).toEqual(['held.xlsx'])
    expect(dialog.querySelector('.ant-upload-list-item-done')).toBeNull()
    expect(requests).toHaveLength(0)
  })

  it('should honor a controlled list, rejected removal, hidden lists and uploading disable', async () => {
    const remove = rstest.fn(() => false)
    const beforeUpload = rstest.fn(() => false)
    const uploadProps: UploadProps = {
      fileList: [{ uid: 'kept', name: 'kept.xlsx', status: 'done' }],
      onRemove: remove,
      beforeUpload,
    }
    const { rerender } = render(<ListExcelActions importAction={{ uploadProps }} />)
    const dialog = await openImport()
    fireEvent.click(within(dialog).getByTitle('Remove file'))
    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1))
    expect(within(dialog).getByText('kept.xlsx')).toBeTruthy()

    rerender(<ListExcelActions importAction={{ uploadProps, uploading: true }} />)
    expect(inputOf(dialog).disabled).toBe(true)
    await dropFiles(dialog, new File(['blocked'], 'blocked.xlsx'))
    expect(beforeUpload).not.toHaveBeenCalled()
    expect(requests).toHaveLength(0)
    rerender(
      <ListExcelActions importAction={{ uploadProps: { ...uploadProps, showUploadList: false } }} />
    )
    expect(inputOf(dialog).disabled).toBe(false)
    expect(dialog.querySelector('.ant-upload-list')).toBeNull()
  })

  it('should deliver native progress and error callbacks and allow the factory to close on success', async () => {
    const pending: RequestOptions[] = []
    const changes: Array<{ status: UploadFile['status']; percent?: number }> = []
    let closeImport: () => void = () => undefined
    render(
      <ListExcelActions
        importAction={{
          uploadProps: ({ close }) => {
            closeImport = close
            return {
              customRequest: (options) => {
                pending.push(options)
              },
              onChange: ({ file }) => changes.push({ status: file.status, percent: file.percent }),
            }
          },
        }}
      />
    )
    const dialog = await openImport()
    selectFiles(dialog, new File(['failure'], 'failure.xlsx'))
    await waitFor(() => expect(pending).toHaveLength(1))
    await act(async () => pending[0].onProgress?.({ percent: 37 }))
    await waitFor(() => expect(changes).toContainEqual({ status: 'uploading', percent: 37 }))
    await act(async () => pending[0].onError?.(new Error('合成上传失败')))
    await waitFor(() => expect(dialog.querySelector('.ant-upload-list-item-error')).toBeTruthy())
    expect(changes.some(({ status }) => status === 'error')).toBe(true)
    expect(screen.getByRole('dialog')).toBeTruthy()

    selectFiles(dialog, new File(['success'], 'success.xlsx'))
    await waitFor(() => expect(pending).toHaveLength(2))
    await act(async () => {
      pending[1].onSuccess?.({ ok: true })
      closeImport()
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(changes.some(({ status }) => status === 'done')).toBe(true)
    expect(requests).toHaveLength(0)
  })
})

describe('FilePicker custom trigger Browser Mode', () => {
  it.each(['local', 'native'] as const)(
    'opens the file input from a custom %s trigger and respects disabled and hidden states',
    async (mode) => {
      const props: FilePickerProps =
        mode === 'native'
          ? { nativeUploadProps: { beforeUpload: () => false as const } }
          : { value: [], onChange: () => undefined }
      const { container, rerender } = render(
        <FilePicker {...props} displayMode="button">
          <Button type="link">选择目录</Button>
        </FilePicker>
      )
      const click = rstest.spyOn(inputOf(container), 'click').mockImplementation(() => undefined)
      await page.getByRole('button', { name: '选择目录', exact: true }).click()
      expect(click).toHaveBeenCalledTimes(1)
      click.mockRestore()
      rerender(
        <FilePicker {...props} displayMode="button">
          <Button type="primary" loading disabled>
            选择目录
          </Button>
        </FilePicker>
      )
      const button = screen.getByRole('button', { name: /选择目录/ })
      expect(button).toHaveProperty('disabled', true)
      expect(button.className).toContain('ant-btn-loading')
      expect(button.className).toContain('ant-btn-primary')
      rerender(
        <FilePicker {...props} displayMode="button">
          {null}
        </FilePicker>
      )
      expect(screen.queryByRole('button', { name: /选择目录|上传文件|选择文件/ })).toBeNull()
      expect(requests).toHaveLength(0)
    }
  )
})

it('changes local error language in place while retaining the raw file and callback counts', async () => {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en-US')
  const changed = rstest.fn()
  const invalid = rstest.fn()
  const Switch = () => {
    const { setLocale } = useI18n()
    return <Button onClick={() => setLocale('zh-CN')}>中文</Button>
  }
  const file = new File(['keep'], 'kept.xlsx')
  const { container } = render(
    <I18nProvider>
      <FilePicker accept=".xlsx" value={[file]} onChange={changed} onInvalid={invalid} />
      <Switch />
    </I18nProvider>
  )
  selectFiles(container, new File([], 'empty.xlsx'))
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toBe('The file is empty. Choose another file.')
  )
  await page.getByRole('button', { name: /^中\s*文$/ }).click()
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('文件为空，请重新选择。'))
  await expect.element(page.getByText('kept.xlsx')).toBeVisible()
  expect(changed).not.toHaveBeenCalled()
  expect(invalid).toHaveBeenCalledTimes(1)
  expect(invalid).toHaveBeenCalledWith('The file is empty. Choose another file.')
  expect(requests).toHaveLength(0)
})
