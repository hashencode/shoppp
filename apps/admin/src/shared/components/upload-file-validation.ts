import type { UploadProps } from 'antd'

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp']

export const readAcceptTypes = (accept: UploadProps['accept']) => {
  const acceptFormat = typeof accept === 'string' ? accept : accept?.format
  return (
    acceptFormat
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  )
}

export const matchesAcceptedType = (file: File, accept: UploadProps['accept']) => {
  const acceptTypes = readAcceptTypes(accept).map((item) => item.toLowerCase())
  if (acceptTypes.length === 0) {
    return true
  }

  const fileName = file.name.toLowerCase()
  const fileType = file.type.toLowerCase()
  return acceptTypes.some((item) => {
    if (item === '*' || item === '*/*') {
      return true
    }
    if (item.startsWith('.')) {
      return fileName.endsWith(item)
    }
    if (item.endsWith('/*')) {
      const mimePrefix = item.slice(0, -1)
      return (
        fileType.startsWith(mimePrefix) ||
        (item === 'image/*' && IMAGE_EXTENSIONS.some((extension) => fileName.endsWith(extension)))
      )
    }
    return fileType === item
  })
}

export const exceedsFileSize = (file: File, limitMB: number) => file.size > limitMB * 1024 * 1024
