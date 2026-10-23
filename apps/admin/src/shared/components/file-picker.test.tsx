import React, { useState } from 'react'
import { Button, ConfigProvider } from 'antd'
import { describe, expect, it, rstest } from '@rstest/core'
import { render as renderWithApp } from '../../test/render-with-app'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { I18nProvider, useI18n, LANGUAGE_STORAGE_KEY } from '../contexts/i18n-context'
import { FilePicker, type FilePickerProps } from './file-picker'

void React

const render = (ui: React.ReactNode) =>
  renderWithApp(ui, {
    wrapper: ({ children }) => (
      <ConfigProvider theme={{ token: { motion: false } }}>{children}</ConfigProvider>
    ),
  })

const inputOf = (container: HTMLElement) => container.querySelector('input[type="file"]')!
const choose = (container: HTMLElement, ...files: File[]) =>
  fireEvent.change(inputOf(container), { target: { files } })

describe('FilePicker local files', () => {
  it('returns original files once and follows replacement, removal and external clear', async () => {
    const changes = rstest.fn()
    const Wrapper = () => {
      const [files, setFiles] = useState<File[]>([])
      return (
        <>
          <FilePicker
            value={files}
            onChange={(next) => {
              changes(next)
              setFiles(next)
            }}
          />
          <button onClick={() => setFiles([])}>清空</button>
        </>
      )
    }
    const { container } = render(<Wrapper />)
    const a = new File(['a'], 'same.xlsx', { lastModified: 123 })
    const b = new File(['b'], 'same.xlsx', { lastModified: 456 })
    choose(container, a)
    await waitFor(() => expect(changes).toHaveBeenCalledTimes(1))
    expect(changes.mock.calls[0][0][0]).toBe(a)
    expect(container.querySelector('.ant-upload-list-item-done')).toBeNull()
    choose(container, b)
    await waitFor(() => expect(changes).toHaveBeenCalledTimes(2))
    expect(changes.mock.calls[1][0][0]).toBe(b)
    await waitFor(() => expect(container.querySelectorAll('.ant-upload-list-item')).toHaveLength(1))
    fireEvent.click(container.querySelector('[title="Remove file"]')!)
    await waitFor(() => expect(changes).toHaveBeenLastCalledWith([]))
    choose(container, b)
    await waitFor(() => expect(screen.getByText('same.xlsx')).toBeTruthy())
    fireEvent.click(screen.getByText('清空'))
    await waitFor(() => expect(container.querySelector('.ant-upload-list-item')).toBeNull())
  })

  it.each([
    [new File(['bad'], 'wrong.txt'), '文件格式不支持，请上传 .xlsx 格式文件。'],
    [new File([], 'empty.xlsx'), '文件为空，请重新选择。'],
    [new File([new Uint8Array(1025)], 'large.xlsx'), '文件大小不能超过 0.0009765625MB。'],
  ])('keeps invalid feedback when its owner clears an earlier file', async (bad, message) => {
    const Wrapper = () => {
      const [files, setFiles] = useState([new File(['ok'], 'old.xlsx')])
      return (
        <FilePicker
          accept=".xlsx"
          fileSizeLimitMB={1 / 1024}
          value={files}
          onChange={setFiles}
          onInvalid={() => setFiles([])}
        />
      )
    }
    const { container } = render(<Wrapper />)
    choose(container, bad)
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', message)
    await waitFor(() => expect(container.querySelector('.ant-upload-list-item')).toBeNull())
    const control = container.querySelector('[aria-invalid="true"]')!
    expect(control.getAttribute('aria-describedby')).toContain(screen.getByRole('alert').id)
    choose(container, new File(['ok'], 'next.xlsx'))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(screen.getByText('next.xlsx')).toBeTruthy()
  })

  it('notifies once per batch, appends raw files, and rejects overflow', async () => {
    const changes = rstest.fn()
    const invalid = rstest.fn()
    const a = new File(['a'], 'a.txt', { type: 'text/plain' })
    const b = new File(['b'], 'b.txt', { type: 'text/plain' })
    const Wrapper = () => {
      const [files, setFiles] = useState<File[]>([])
      return (
        <FilePicker
          multiple
          maxCount={2}
          accept="text/*"
          value={files}
          onChange={(next) => {
            changes(next)
            setFiles(next)
          }}
          onInvalid={invalid}
        />
      )
    }
    const { container } = render(<Wrapper />)
    choose(container, a, b)
    await waitFor(() => expect(changes).toHaveBeenCalledTimes(1))
    expect(changes.mock.calls[0][0][0]).toBe(a)
    expect(changes.mock.calls[0][0][1]).toBe(b)
    choose(container, new File(['c'], 'c.txt', { type: 'text/plain' }))
    await waitFor(() => expect(invalid).toHaveBeenCalledTimes(1))
    expect(changes).toHaveBeenCalledTimes(1)
  })

  it('rejects an input batch when a later file is empty', async () => {
    const change = rstest.fn()
    const invalid = rstest.fn()
    const { container } = render(
      <FilePicker multiple maxCount={2} value={[]} onChange={change} onInvalid={invalid} />
    )
    choose(container, new File(['valid'], 'valid.xlsx'), new File([], 'empty.xlsx'))
    await waitFor(() => expect(invalid).toHaveBeenCalledTimes(1))
    expect(change).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('文件为空，请重新选择。')
  })

  it('checks synchronous selection and removal guards before changing errors or values', async () => {
    let allowed = true
    const changes = rstest.fn()
    const invalid = rstest.fn()
    const props: FilePickerProps = {
      value: [new File(['ok'], 'kept.xlsx')],
      onChange: changes,
      onInvalid: invalid,
      accept: '.xlsx',
      onBeforeSelect: () => allowed,
      onBeforeRemove: () => allowed,
    }
    const { container, rerender } = render(<FilePicker {...props} />)
    choose(container, new File([], 'empty.xlsx'))
    await screen.findByRole('alert')
    allowed = false
    choose(container, new File(['ok'], 'new.xlsx'))
    fireEvent.click(screen.getByTitle('Remove file'))
    await waitFor(() => expect(screen.getByText('kept.xlsx')).toBeTruthy())
    expect(screen.getByRole('alert')).toHaveProperty('textContent', '文件为空，请重新选择。')
    expect(changes).not.toHaveBeenCalled()
    expect(invalid).toHaveBeenCalledTimes(1)
    rerender(<FilePicker {...props} disabled />)
    choose(container, new File([], 'disabled.xlsx'))
    expect(invalid).toHaveBeenCalledTimes(1)
  })
})

describe('FilePicker custom triggers', () => {
  it.each(['local', 'native'] as const)(
    'uses custom link and primary nodes in %s mode without replacing their state',
    (mode) => {
      const props: FilePickerProps =
        mode === 'native'
          ? { nativeUploadProps: { disabled: true } }
          : { value: [], onChange: () => undefined, disabled: true }
      const { rerender } = render(
        <FilePicker {...props} displayMode="button">
          <Button type="link" loading disabled>
            导入工作簿
          </Button>
        </FilePicker>
      )
      const link = screen.getByRole('button', { name: /导入工作簿/ })
      expect(link.className).toContain('ant-btn-link')
      expect(link.className).toContain('ant-btn-loading')
      expect(link).toHaveProperty('disabled', true)
      expect(screen.queryByRole('button', { name: /上传文件|选择文件/ })).toBeNull()
      rerender(
        <FilePicker {...props} displayMode="button">
          <Button type="primary" disabled>
            选择目录
          </Button>
        </FilePicker>
      )
      expect(screen.getByRole('button', { name: '选择目录' }).className).toContain(
        'ant-btn-primary'
      )
    }
  )

  it.each(['local', 'native'] as const)(
    'shows the default only for undefined children in %s mode',
    (mode) => {
      const props: FilePickerProps =
        mode === 'native' ? { nativeUploadProps: {} } : { value: [], onChange: () => undefined }
      const { container, rerender } = render(<FilePicker {...props} displayMode="button" />)
      expect(screen.getByRole('button', { name: /上传文件|选择文件/ })).toBeTruthy()
      rerender(
        <FilePicker {...props} displayMode="button">
          {null}
        </FilePicker>
      )
      expect(container.querySelector('button')).toBeNull()
      expect(screen.queryByText(/上传文件|选择文件/)).toBeNull()
    }
  )
})

describe('FilePicker native batches', () => {
  it('preserves directory, multiple, raw relative paths and the shared selection batch without local limits', async () => {
    const beforeUpload = rstest.fn((_file: File, _files: File[]) => false as const)
    const change = rstest.fn()
    const files = ['one.xlsx', 'two.xlsx', 'three.xlsx'].map((name) =>
      Object.defineProperty(new File([], name), 'webkitRelativePath', { value: `folder/${name}` })
    )
    const { container } = render(
      <FilePicker
        nativeUploadProps={{ directory: true, multiple: true, beforeUpload, onChange: change }}
      />
    )
    const input = inputOf(container) as HTMLInputElement
    expect(input.multiple).toBe(true)
    expect(input.hasAttribute('webkitdirectory')).toBe(true)
    choose(container, ...files)
    await waitFor(() => expect(beforeUpload).toHaveBeenCalledTimes(3))
    expect(beforeUpload.mock.calls.map(([file]) => file)).toEqual(files)
    for (const [file, batch] of beforeUpload.mock.calls) {
      expect(batch).toBe(beforeUpload.mock.calls[0][1])
      expect(batch).toEqual(files)
      expect(file.webkitRelativePath).toBe(`folder/${file.name}`)
    }
    await waitFor(() => expect(change).toHaveBeenCalledTimes(3))
    expect(container.querySelectorAll('.ant-upload-list-item')).toHaveLength(3)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

const LanguageSwitch = () => {
  const { setLocale } = useI18n()
  return <button onClick={() => setLocale('en-US')}>English</button>
}

it('translates a retained validation error without changing files or repeating callbacks', async () => {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'zh-CN')
  const changed = rstest.fn()
  const invalid = rstest.fn()
  const kept = new File(['kept'], 'kept.xlsx')
  const { container } = render(
    <I18nProvider>
      <FilePicker value={[kept]} accept=".xlsx" onChange={changed} onInvalid={invalid} />
      <LanguageSwitch />
    </I18nProvider>
  )
  choose(container, new File([], 'empty.xlsx'))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', '文件为空，请重新选择。')
  expect(invalid).toHaveBeenCalledExactlyOnceWith('文件为空，请重新选择。')
  fireEvent.click(screen.getByRole('button', { name: 'English' }))
  expect(screen.getByRole('alert')).toHaveProperty(
    'textContent',
    'The file is empty. Choose another file.'
  )
  expect(screen.getByText('kept.xlsx')).toBeTruthy()
  expect(changed).not.toHaveBeenCalled()
  expect(invalid).toHaveBeenCalledTimes(1)
  choose(container, new File(['bad'], 'wrong.txt'))
  await waitFor(() =>
    expect(invalid).toHaveBeenLastCalledWith('Unsupported file format. Upload .xlsx files.')
  )
  window.localStorage.removeItem(LANGUAGE_STORAGE_KEY)
})

it('removes the exact file after controlled reordering of identical file metadata', async () => {
  const first = new File(['same'], 'same.pdf', { lastModified: 123 })
  const second = new File(['same'], 'same.pdf', { lastModified: 123 })
  const changed = rstest.fn()
  const { container, rerender } = render(
    <FilePicker multiple value={[first, second]} onChange={changed} />
  )
  rerender(<FilePicker multiple value={[second, first]} onChange={changed} />)
  expect(changed).not.toHaveBeenCalled()
  const rows = container.querySelectorAll('.ant-upload-list-item')
  expect(rows).toHaveLength(2)
  fireEvent.click(rows[1].querySelector<HTMLButtonElement>('.ant-upload-list-item-action')!)
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1))
  const remaining = changed.mock.calls[0][0] as File[]
  expect(remaining).toHaveLength(1)
  expect(remaining[0]).toBe(second)
})
