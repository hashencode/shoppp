import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, rstest } from '@rstest/core'
import { Upload, message } from 'antd'
import React, { useState } from 'react'
import { normalizeUploadUrl, UploadFormItem, type UploadFormItemValue } from './upload-form-item'

void React

afterEach(() => {
  rstest.restoreAllMocks()
})

rstest.mock('compressorjs', () => ({
  default: class CompressorMock {
    constructor(
      file: File,
      options?: {
        success?: (result: File | Blob) => void
        error?: (error: Error) => void
      }
    ) {
      if (file.name === 'compression-fails.png') {
        options?.error?.(new Error('compression failed'))
        return
      }
      if (file.name === 'animated.gif') {
        throw new Error('GIF should bypass compression')
      }
      if (file.name === 'converted-image.png') {
        options?.success?.(new Blob(['x'], { type: 'image/jpeg' }))
        return
      }
      if (file.name === 'still-large.png') {
        options?.success?.(new Blob(['01234567890123456789'], { type: 'image/png' }))
        return
      }
      options?.success?.(file)
    }
  },
}))

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

const getUploadInput = (container: HTMLElement) => {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement | null
  expect(input).toBeTruthy()
  return input as HTMLInputElement
}

const getUploadSelect = (container: HTMLElement) => {
  const uploadSelect = container.querySelector('.ax-upload-form-item .ant-upload-select')
  expect(uploadSelect).toBeTruthy()
  return uploadSelect as HTMLElement
}

describe('UploadFormItem', () => {
  it('uses card mode only for image-only accept values and supports explicit overrides', () => {
    const uploadFile = async () => '/uploads/file'
    const { container, rerender } = render(
      <UploadFormItem accept=".jpg,image/png" uploadFile={uploadFile} />
    )

    expect(container.querySelector('.ax-upload-form-item--card')).toBeTruthy()
    expect(container.querySelector('.ant-upload-list-picture-card')).toBeTruthy()
    expect(getUploadInput(container).accept).toBe('.jpg,image/png')

    rerender(<UploadFormItem accept=".pdf,.jpg" uploadFile={uploadFile} />)
    expect(container.querySelector('.ax-upload-form-item--button')).toBeTruthy()
    expect(screen.getByRole('button', { name: '上传文件' })).toBeTruthy()

    rerender(
      <UploadFormItem
        accept=".pdf,.jpg"
        value={['/uploads/manual.pdf', '/uploads/photo.JPG?x=1#preview']}
        uploadFile={uploadFile}
      />
    )
    expect(container.querySelector('.ax-upload-form-item--card')).toBeTruthy()

    rerender(
      <UploadFormItem
        accept=".pdf,.jpg"
        maxCount={2}
        value="/uploads/manual.pdf,/uploads/photo.PNG?x=1#preview"
        uploadFile={uploadFile}
      />
    )
    expect(container.querySelector('.ax-upload-form-item--card')).toBeTruthy()

    rerender(
      <UploadFormItem
        accept=".jpg"
        displayMode="button"
        uploadFile={uploadFile}
      />
    )
    expect(container.querySelector('.ax-upload-form-item--button')).toBeTruthy()

    rerender(<UploadFormItem accept=".pdf" listType="picture-card" uploadFile={uploadFile} />)
    expect(container.querySelector('.ax-upload-form-item--card')).toBeTruthy()
  })

  it('defaults to images and validates the transformed candidate before uploading', async () => {
    const uploaded: File[] = []
    const { container, rerender } = render(
      <UploadFormItem
        beforeUpload={() =>
          new File(['image'], 'converted.jpg', { type: 'image/jpeg', lastModified: 123 })
        }
        uploadFile={async (file) => {
          uploaded.push(file)
          return '/uploads/converted.jpg'
        }}
      />
    )

    expect(getUploadInput(container).accept).toBe('.jpg,.jpeg,.png')
    fireEvent.change(getUploadInput(container), {
      target: { files: [new File(['image'], 'source.heic', { type: 'image/heic' })] },
    })
    await waitFor(() => expect(uploaded[0]?.name).toBe('converted.jpg'))
    expect(uploaded[0]?.lastModified).toBe(123)

    rerender(
      <UploadFormItem
        accept=".jpg"
        beforeUpload={() => new Blob(['image'], { type: 'image/jpeg' })}
        uploadFile={async (file) => {
          uploaded.push(file)
          return '/uploads/unexpected.jpg'
        }}
      />
    )
    fireEvent.change(getUploadInput(container), {
      target: { files: [new File(['image'], 'source.heic', { type: 'image/heic' })] },
    })
    await waitFor(() => expect(document.body.textContent).toContain('文件格式不支持'))
    expect(uploaded).toHaveLength(1)
    expect(container.textContent).not.toContain('source.heic')
  })

  it('preserves external rejections and reports its own rejection exactly once without side effects', async () => {
    const errorSpy = rstest.spyOn(message, 'error')
    const externalResults: Array<boolean | string> = []
    let uploadCount = 0
    let changeCount = 0
    const { container, rerender } = render(
      <UploadFormItem
        multiple
        maxCount={2}
        beforeUpload={(file) => {
          const result = file.name === 'ignored.png' ? Upload.LIST_IGNORE : false
          externalResults.push(result)
          return result
        }}
        uploadFile={async () => {
          uploadCount += 1
          return '/uploads/unexpected.png'
        }}
      />
    )

    fireEvent.change(getUploadInput(container), {
      target: {
        files: [
          new File(['a'], 'ignored.png', { type: 'image/png' }),
          new File(['b'], 'blocked.png', { type: 'image/png' }),
        ],
      },
    })
    await waitFor(() => expect(externalResults).toEqual([Upload.LIST_IGNORE, false]))
    expect(errorSpy).not.toHaveBeenCalled()

    rerender(
      <UploadFormItem
        accept=".jpg"
        value="/uploads/existing.jpg"
        uploadFile={async () => {
          uploadCount += 1
          return '/uploads/unexpected.jpg'
        }}
        onChange={() => {
          changeCount += 1
        }}
      />
    )
    await waitFor(() => expect(container.querySelector('a[href="/uploads/existing.jpg"]')).toBeTruthy())
    fireEvent.change(getUploadInput(container), {
      target: { files: [new File(['image'], 'rejected.heic', { type: 'image/heic' })] },
    })
    await waitFor(() => expect(errorSpy).toHaveBeenCalledTimes(1))
    expect(uploadCount).toBe(0)
    expect(changeCount).toBe(0)
    expect(container.querySelector('a[href="/uploads/existing.jpg"]')).toBeTruthy()
    expect(container.textContent).not.toContain('rejected.heic')
  })

  it('compresses supported images and aligns the filename with the output mime type', async () => {
    let uploadedFile: File | undefined
    const { container } = render(
      <UploadFormItem
        accept="image/*"
        uploadFile={async (file) => {
          uploadedFile = file
          return '/uploads/converted.jpg'
        }}
      />
    )

    fireEvent.change(getUploadInput(container), {
      target: {
        files: [
          new File(['uncompressed'], 'converted-image.png', {
            type: 'image/png',
          }),
        ],
      },
    })

    await waitFor(() => expect(uploadedFile).toBeTruthy())
    expect(uploadedFile?.name).toBe('converted-image.jpg')
    expect(uploadedFile?.type).toBe('image/jpeg')
    expect(uploadedFile?.size).toBe(1)
  })

  it('bypasses GIF compression and blocks upload on compression failures or oversized results', async () => {
    const uploadedFiles: File[] = []
    const { container } = render(
      <UploadFormItem
        accept="image/*"
        fileSizeLimitMB={0.00001}
        maxCount={3}
        multiple
        uploadFile={async (file) => {
          uploadedFiles.push(file)
          return `/uploads/${file.name}`
        }}
      />
    )
    const gif = new File(['x'], 'animated.gif', { type: 'image/gif' })

    fireEvent.change(getUploadInput(container), { target: { files: [gif] } })
    await waitFor(() => expect(uploadedFiles).toEqual([gif]))

    fireEvent.change(getUploadInput(container), {
      target: {
        files: [
          new File(['x'], 'compression-fails.png', { type: 'image/png' }),
          new File(['x'], 'still-large.png', { type: 'image/png' }),
        ],
      },
    })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(uploadedFiles).toEqual([gif])
  })

  it('normalizes host-only upload urls for preview display', () => {
    expect(normalizeUploadUrl('oss.example.com/license.png')).toBe('https://oss.example.com/license.png')
    expect(normalizeUploadUrl('//oss.example.com/license.png')).toBe('https://oss.example.com/license.png')
    expect(normalizeUploadUrl('/uploads/license.png')).toBe('/uploads/license.png')
    expect(normalizeUploadUrl('uploads/license.png')).toBe('uploads/license.png')
  })

  it('delegates non-image preview to FilePreview instead of opening the file directly', async () => {
    const openSpy = rstest.spyOn(window, 'open')
    const { container } = render(
      <UploadFormItem
        readonly
        value="/uploads/existing.pdf"
        uploadFile={async () => '/uploads/next.pdf'}
      />
    )

    const previewTrigger = container.querySelector('.ant-upload-list-item-name')
    expect(previewTrigger).toBeTruthy()
    fireEvent.click(previewTrigger as HTMLElement)

    expect(await screen.findByRole('dialog', { name: '文件预览' })).toBeTruthy()
    expect(openSpy).not.toHaveBeenCalled()
    openSpy.mockRestore()
  })

  it('renders tooltip with upload spacing in button mode', () => {
    const tooltip = '请上传格式为jpg、jpeg、png格式，大小不超过10MB的文件'
    const { container } = render(
      <UploadFormItem displayMode="button" tooltip={tooltip} uploadFile={async () => 'https://oss.example.com/license.png'} />
    )

    const hint = screen.getByText(tooltip)
    expect(hint.className.split(/\s+/)).toContain('mt-2')
    expect(hint.className.split(/\s+/)).toContain('text-description')
    expect(container.querySelector('.ax-upload-form-item')?.nextElementSibling).toBe(hint)
    expect(screen.getByRole('button', { name: '上传文件' })).toBeTruthy()
  })

  it('writes uploaded url when upload succeeds', async () => {
    const changes: Array<UploadFormItemValue | undefined> = []
    let uploadedFileName = ''
    const uploadFile = async (file: File) => {
      uploadedFileName = file.name
      return 'https://oss.example.com/license.png'
    }

    const { container } = render(
      <UploadFormItem
        value="/uploads/existing.pdf"
        uploadFile={uploadFile}
        onChange={(nextValue) => changes.push(nextValue)}
      />
    )

    fireEvent.change(getUploadInput(container), {
      target: {
        files: [new File(['image'], 'license.png', { type: 'image/png' })],
      },
    })

    await waitFor(() => {
      expect(changes[0]).toBe('https://oss.example.com/license.png')
    })
    expect(uploadedFileName).toBe('license.png')
  })

  it('keeps current value when upload fails', async () => {
    const changes: Array<UploadFormItemValue | undefined> = []
    let rejectUpload: ((error: Error) => void) | undefined
    const uploadFile = () =>
      new Promise<string>((_, reject) => {
        rejectUpload = reject
      })

    const { container } = render(
      <UploadFormItem
        value="/uploads/existing.pdf"
        uploadFile={uploadFile}
        onChange={(nextValue) => changes.push(nextValue)}
      />
    )

    fireEvent.change(getUploadInput(container), {
      target: {
        files: [new File(['image'], 'license.png', { type: 'image/png' })],
      },
    })

    await waitFor(() => {
      expect(rejectUpload).toBeTruthy()
      expect(container.querySelector('.ant-upload-list-item-uploading')).toBeTruthy()
    })

    rejectUpload?.(new Error('上传失败'))

    await waitFor(() => {
      expect(container.textContent).toContain('existing.pdf')
    })
    expect(changes.length).toBe(0)
  })

  it('keeps both files when concurrent uploads finish out of order', async () => {
    const changes: Array<UploadFormItemValue | undefined> = []
    const pending = new Map<string, (url: string) => void>()
    const uploadFile = (file: File) => new Promise<string>((resolve) => pending.set(file.name, resolve))
    const Wrapper = () => {
      const [value, setValue] = useState<string[]>([])
      return (
        <UploadFormItem
          accept=".pdf"
          multiple
          maxCount={2}
          value={value}
          uploadFile={uploadFile}
          onChange={(nextValue) => {
            changes.push(nextValue)
            if (Array.isArray(nextValue)) setValue(nextValue)
          }}
        />
      )
    }
    const { container } = render(<Wrapper />)

    fireEvent.change(getUploadInput(container), {
      target: { files: [new File(['a'], 'a.pdf'), new File(['b'], 'b.pdf')] },
    })
    await waitFor(() => expect(pending.size).toBe(2))
    pending.get('b.pdf')?.('/uploads/b.pdf')
    pending.get('a.pdf')?.('/uploads/a.pdf')

    await waitFor(() => expect([...(changes.at(-1) as string[])].sort()).toEqual(['/uploads/a.pdf', '/uploads/b.pdf']))
  })

  it('does not roll back a successful sibling when another concurrent upload fails', async () => {
    const changes: Array<UploadFormItemValue | undefined> = []
    const pending = new Map<string, { resolve: (url: string) => void; reject: (error: Error) => void }>()
    const uploadFile = (file: File) =>
      new Promise<string>((resolve, reject) => pending.set(file.name, { resolve, reject }))
    const { container } = render(
      <UploadFormItem
        accept=".pdf"
        multiple
        maxCount={2}
        uploadFile={uploadFile}
        onChange={(value) => changes.push(value)}
      />
    )

    fireEvent.change(getUploadInput(container), {
      target: { files: [new File(['a'], 'a.pdf'), new File(['b'], 'b.pdf')] },
    })
    await waitFor(() => expect(pending.size).toBe(2))
    pending.get('a.pdf')?.resolve('/uploads/a.pdf')
    pending.get('b.pdf')?.reject(new Error('b failed'))

    await waitFor(() => expect(changes.at(-1)).toEqual(['/uploads/a.pdf']))
  })

  it('keeps an external controlled value authoritative while an upload is pending', async () => {
    const changes: Array<UploadFormItemValue | undefined> = []
    let resolveUpload: ((url: string) => void) | undefined
    const uploadFile = () => new Promise<string>((resolve) => { resolveUpload = resolve })
    const Wrapper = () => {
      const [value, setValue] = useState<string[]>([])
      return (
        <>
          <button type="button" onClick={() => setValue(['/uploads/external.pdf'])}>外部更新</button>
          <UploadFormItem
            accept=".pdf"
            multiple
            maxCount={2}
            value={value}
            uploadFile={uploadFile}
            onChange={(nextValue) => {
              changes.push(nextValue)
              if (Array.isArray(nextValue)) setValue(nextValue)
            }}
          />
        </>
      )
    }
    const { container } = render(<Wrapper />)

    fireEvent.change(getUploadInput(container), { target: { files: [new File(['a'], 'a.pdf')] } })
    await waitFor(() => expect(resolveUpload).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: '外部更新' }))
    resolveUpload?.('/uploads/a.pdf')

    await waitFor(() => expect(container.textContent).toContain('external.pdf'))
    expect(changes).toEqual([])
  })

  it('does not restore a removed in-flight file after its upload succeeds', async () => {
    const changes: Array<UploadFormItemValue | undefined> = []
    let resolveUpload: ((url: string) => void) | undefined
    const uploadFile = () => new Promise<string>((resolve) => { resolveUpload = resolve })
    const { container } = render(
      <UploadFormItem
        accept=".pdf"
        multiple
        maxCount={2}
        uploadFile={uploadFile}
        onChange={(value) => changes.push(value)}
        itemRender={(_, __, ___, actions) => (
          <button type="button" onClick={actions.remove}>移除上传文件</button>
        )}
      />
    )

    fireEvent.change(getUploadInput(container), { target: { files: [new File(['a'], 'a.pdf')] } })
    fireEvent.click(await screen.findByRole('button', { name: '移除上传文件' }))
    await waitFor(() => expect(changes.at(-1)).toEqual([]))

    resolveUpload?.('/uploads/a.pdf')
    await waitFor(() => expect(getUploadSelect(container)).toBeTruthy())
    expect(container.textContent).not.toContain('a.pdf')
    expect(changes.at(-1)).toEqual([])
  })

  it('does not emit a late upload result after unmount', async () => {
    const changes: Array<UploadFormItemValue | undefined> = []
    let resolveUpload: ((url: string) => void) | undefined
    const uploadFile = () => new Promise<string>((resolve) => { resolveUpload = resolve })
    const { container, unmount } = render(
      <UploadFormItem accept=".pdf" uploadFile={uploadFile} onChange={(value) => changes.push(value)} />
    )

    fireEvent.change(getUploadInput(container), { target: { files: [new File(['a'], 'a.pdf')] } })
    await waitFor(() => expect(resolveUpload).toBeTruthy())
    unmount()
    await act(async () => {
      resolveUpload?.('/uploads/a.pdf')
      await Promise.resolve()
    })

    expect(changes).toEqual([])
  })

  it('rejects files over size limit before calling upload', () => {
    const changes: Array<UploadFormItemValue | undefined> = []
    let uploadCount = 0
    const uploadFile = async () => {
      uploadCount += 1
      return 'https://oss.example.com/large.png'
    }

    const { container } = render(
      <UploadFormItem
        fileSizeLimitMB={0.000001}
        uploadFile={uploadFile}
        onChange={(nextValue) => changes.push(nextValue)}
      />
    )

    fireEvent.change(getUploadInput(container), {
      target: {
        files: [new File(['larger-than-limit'], 'large.png', { type: 'image/png' })],
      },
    })

    expect(uploadCount).toBe(0)
    expect(changes.length).toBe(0)
  })

  it('keeps disabled upload control when readonly value is missing', () => {
    const { container } = render(
      <UploadFormItem readonly uploadFile={async () => 'https://oss.example.com/next.png'} />
    )

    expect(getUploadSelect(container).className).toContain('ant-upload-disabled')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null
    expect(input?.disabled).toBe(true)
  })

  it('disables mutation controls in readonly mode when value exists', () => {
    const { container } = render(
      <UploadFormItem
        readonly
        value="oss.example.com/existing.png"
        uploadFile={async () => 'https://oss.example.com/next.png'}
      />
    )

    expect(container.querySelector('.ax-upload-form-item')).toBeTruthy()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null
    expect(input?.disabled).toBe(true)
    expect(container.innerHTML).toContain('https://oss.example.com/existing.png')
  })
})
