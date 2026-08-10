import '../../index.css'

import { expect, it, describe } from '@rstest/core'
import { page } from '@rstest/browser'
import { render, waitFor } from '@testing-library/react'
import React from 'react'
import { UploadFormItem } from './upload-form-item'

void React

const createLargeImage = async () => {
  const canvas = document.createElement('canvas')
  canvas.width = 1800
  canvas.height = 1800
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas is unavailable')
  }

  const imageData = context.createImageData(canvas.width, canvas.height)
  let seed = 1
  for (let index = 0; index < imageData.data.length; index += 4) {
    seed = (seed * 16807) % 2147483647
    imageData.data[index] = seed % 256
    imageData.data[index + 1] = (seed >> 8) % 256
    imageData.data[index + 2] = (seed >> 16) % 256
    imageData.data[index + 3] = 255
  }
  context.putImageData(imageData, 0, 0)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result)
      } else {
        reject(new Error('Failed to create image'))
      }
    }, 'image/png')
  })
  return new File([blob], 'large-image.png', { type: 'image/png' })
}

describe('UploadFormItem Browser Mode', () => {
  it('renders the card trigger and tooltip spacing in a real browser', async () => {
    render(
      <UploadFormItem
        accept="image/*"
        tooltip="请上传格式为jpg、jpeg、png格式，大小不超过10MB的文件"
        uploadFile={async () => 'https://oss.example.com/license.png'}
      />
    )

    await expect.element(page.locator('.ax-upload-form-item .ant-upload-select')).toBeVisible()
    await expect.element(page.getByText('请上传格式为jpg、jpeg、png格式，大小不超过10MB的文件')).toBeVisible()

    const uploadSelect = document.querySelector('.ax-upload-form-item .ant-upload-select')
    const tooltip = document.querySelector('.mt-2.text-description')
    expect(uploadSelect).toBeTruthy()
    expect(tooltip).toBeTruthy()

    const uploadRect = (uploadSelect as HTMLElement).getBoundingClientRect()
    const tooltipRect = (tooltip as HTMLElement).getBoundingClientRect()

    expect(Math.round(uploadRect.width)).toBe(102)
    expect(Math.round(uploadRect.height)).toBe(102)
    expect(Math.round(tooltipRect.top - uploadRect.bottom)).toBe(8)
    expect(document.querySelector('.ax-upload-form-item button')).toBeNull()
  })

  it('passes the compressed image to the injected uploader', async () => {
    let uploadedFile: File | undefined
    render(
      <UploadFormItem
        accept="image/*"
        fileSizeLimitMB={20}
        uploadFile={async (file) => {
          uploadedFile = file
          return '/uploads/compressed.jpg'
        }}
      />
    )

    const originalFile = await createLargeImage()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const transfer = new DataTransfer()
    transfer.items.add(originalFile)
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))

    await waitFor(() => expect(uploadedFile).toBeTruthy(), { timeout: 5_000 })
    expect(uploadedFile?.size).toBeLessThan(originalFile.size)
    expect(uploadedFile?.name).toBe('large-image.jpg')
    expect(uploadedFile?.type).toBe('image/jpeg')
  })

  it('uses actual values for mixed display mode and keeps rejected files out of the list', async () => {
    let uploadCount = 0
    const { container, rerender } = render(
      <UploadFormItem
        accept=".pdf,.jpg"
        value="/uploads/manual.pdf"
        uploadFile={async () => {
          uploadCount += 1
          return '/uploads/unexpected.jpg'
        }}
      />
    )

    expect(container.querySelector('.ax-upload-form-item--button')).toBeTruthy()
    rerender(
      <UploadFormItem
        accept=".pdf,.jpg"
        value={['/uploads/manual.pdf', '/uploads/photo.JPG?x=1#preview']}
        uploadFile={async () => '/uploads/photo.jpg'}
      />
    )
    expect(container.querySelector('.ax-upload-form-item--card')).toBeTruthy()

    rerender(
      <UploadFormItem
        accept=".jpg"
        uploadFile={async () => {
          uploadCount += 1
          return '/uploads/unexpected.jpg'
        }}
      />
    )
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const transfer = new DataTransfer()
    transfer.items.add(new File(['image'], 'rejected.heic', { type: 'image/heic' }))
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))

    await expect.element(page.getByText(/文件格式不支持/)).toBeVisible()
    expect(uploadCount).toBe(0)
    expect(container.textContent).not.toContain('rejected.heic')
  })
})
