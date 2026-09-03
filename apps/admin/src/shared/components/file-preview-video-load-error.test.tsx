import { render } from '../../test/render-with-app'
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, rstest } from '@rstest/core'
import { FilePreview } from './file-preview'

void React

rstest.mock('react-pdf', () => ({
  pdfjs: {
    GlobalWorkerOptions: {},
  },
  Document: () => null,
  Page: () => null,
}))

rstest.mock('./video-player', () => {
  throw new Error('video module failed')
})

describe('FilePreview video loading failure', () => {
  it('keeps download available when the video preview module cannot load', async () => {
    render(<FilePreview title="视频预览" source="/course.mp4" fileName="course.mp4" />)

    fireEvent.click(screen.getByRole('button', { name: '预览' }))

    expect(await screen.findByText('视频预览加载失败')).toBeTruthy()
    expect(screen.getByRole('button', { name: /下载文件/ })).toBeTruthy()
  })
})
