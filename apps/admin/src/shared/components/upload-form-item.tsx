import './upload-form-item.css'

import { CloudUploadOutlined } from '@ant-design/icons'
import { FileUp } from 'lucide-react'
import { Button, Upload, message } from 'antd'
import classNames from 'classnames'
import type { UploadFile, UploadProps } from 'antd'
import type { RcFile } from 'antd/es/upload'
import Compressor from 'compressorjs'
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'

void React

export type UploadFormItemValue = string | string[]
export type UploadFormItemDisplayMode = 'auto' | 'card' | 'button'

export type UploadFormItemProps = Omit<
  UploadProps,
  'customRequest' | 'fileList' | 'onChange' | 'onPreview' | 'onRemove'
> & {
  value?: UploadFormItemValue
  onChange?: (value?: UploadFormItemValue) => void
  uploadFile: (file: File) => Promise<string>
  fileSizeLimitMB?: number
  readonly?: boolean
  tooltip?: React.ReactNode
  uploadText?: React.ReactNode
  displayMode?: UploadFormItemDisplayMode
}

const DEFAULT_ACCEPT = '.pdf,.jpg,.jpeg,.png'
const DEFAULT_FILE_SIZE_LIMIT_MB = 10
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
const IMAGE_MIME_TYPE_PATTERN = /^image\/(?:\*|[a-z0-9.+-]+)$/i
const COMPRESSED_IMAGE_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}
const COMPRESSIBLE_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

const LazyFilePreview = lazy(() =>
  import('./file-preview').then((module) => ({ default: module.FilePreview }))
)

const resolveCompressedFileName = (file: File, result: Blob) => {
  const resultName = result instanceof File && result.name ? result.name : file.name
  if (!result.type || result.type === file.type) {
    return resultName
  }

  const extension = COMPRESSED_IMAGE_EXTENSION_BY_MIME_TYPE[result.type]
  if (!extension) {
    return resultName
  }

  const baseName = resultName.replace(/\.[^./]+$/, '')
  return `${baseName || resultName}${extension}`
}

const compressImage = (file: RcFile): Promise<RcFile> => {
  if (!COMPRESSIBLE_IMAGE_MIME_TYPES.has(file.type.toLowerCase())) {
    return Promise.resolve(file)
  }

  return new Promise((resolve, reject) => {
    new Compressor(file, {
      quality: 0.8,
      maxWidth: 1200,
      maxHeight: 3000,
      resize: 'contain',
      convertSize: 300 * 1024,
      success: (result) => {
        const compressedFile = new File([result], resolveCompressedFileName(file, result), {
          type: result.type || file.type,
          lastModified: file.lastModified,
        })
        resolve(Object.assign(compressedFile, { uid: file.uid }) as RcFile)
      },
      error: reject,
    })
  })
}

export const normalizeUploadUrl = (value: string) => {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return ''
  }

  if (trimmedValue.startsWith('//')) {
    return `https:${trimmedValue}`
  }

  if (/^(https?:|data:|blob:|\/)/i.test(trimmedValue)) {
    return trimmedValue
  }

  const firstPathSegment = trimmedValue.split('/')[0] ?? ''
  if (firstPathSegment.includes('.')) {
    return `https://${trimmedValue}`
  }

  return trimmedValue
}

const readFileNameFromUrl = (url: string) => {
  const rawName = url.split(/[?#]/)[0]?.split('/').pop() || '已上传文件'

  try {
    return decodeURIComponent(rawName)
  } catch {
    return rawName
  }
}

const isImageAsset = (value: string) => {
  const lower = value.split(/[?#]/)[0]?.toLowerCase() ?? ''
  return IMAGE_EXTENSIONS.some((extension) => lower.endsWith(extension))
}

const readAcceptTypes = (accept: UploadProps['accept']) => {
  const acceptFormat = typeof accept === 'string' ? accept : accept?.format
  return acceptFormat
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean) ?? []
}

const isImageOnlyAccept = (accept: UploadProps['accept']) => {
  const acceptTypes = readAcceptTypes(accept).map((item) => item.toLowerCase())
  return acceptTypes.length > 0 &&
    acceptTypes.every(
      (item) => IMAGE_EXTENSIONS.includes(item) || IMAGE_MIME_TYPE_PATTERN.test(item)
    )
}

const toUploadFile = (url: string, hideImageName: boolean): UploadFile => {
  const normalizedUrl = normalizeUploadUrl(url)
  return {
    uid: normalizedUrl,
    name: hideImageName && isImageAsset(normalizedUrl) ? '' : readFileNameFromUrl(normalizedUrl),
    status: 'done',
    url: normalizedUrl,
  }
}

const readUploadFileUid = (file: File & { uid?: string }) => {
  return file.uid || `${file.name}-${file.lastModified}-${file.size}`
}

const normalizeValueToUrls = (value: UploadFormItemValue | undefined, multipleMode: boolean) => {
  if (!value) {
    return []
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean)
  }

  if (!multipleMode) {
    return [value]
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const toUploadValue = (fileList: UploadFile[], multipleMode: boolean): UploadFormItemValue | undefined => {
  const urls = fileList
    .map((item) => item.url)
    .filter((item): item is string => typeof item === 'string' && item.length > 0)

  if (multipleMode) {
    return urls
  }

  return urls[0]
}

const isSameUploadValue = (
  left: UploadFormItemValue | undefined,
  right: UploadFormItemValue | undefined,
  multipleMode: boolean
) => {
  const leftUrls = normalizeValueToUrls(left, multipleMode).map(normalizeUploadUrl).sort()
  const rightUrls = normalizeValueToUrls(right, multipleMode).map(normalizeUploadUrl).sort()
  return leftUrls.length === rightUrls.length && leftUrls.every((item, index) => item === rightUrls[index])
}

const normalizeUploadError = (error: unknown) => {
  return error instanceof Error ? error : new Error('上传失败，请稍后重试。')
}

const areUploadFileListsEqual = (left: UploadFile[], right: UploadFile[]) =>
  left.length === right.length && left.every((item, index) => {
    const other = right[index]
    return item.uid === other?.uid && item.name === other.name && item.status === other.status && item.url === other.url
  })

export const UploadFormItem = ({
  value,
  onChange,
  uploadFile,
  fileSizeLimitMB = DEFAULT_FILE_SIZE_LIMIT_MB,
  readonly = false,
  tooltip,
  uploadText,
  displayMode = 'auto',
  accept = DEFAULT_ACCEPT,
  maxCount = 1,
  listType,
  className,
  disabled,
  showUploadList,
  beforeUpload,
  children,
  ...restProps
}: UploadFormItemProps) => {
  const multipleMode = Boolean(restProps.multiple) || maxCount > 1
  const effectiveDisabled = readonly || disabled
  const resolvedDisplayMode: Exclude<UploadFormItemDisplayMode, 'auto'> =
    displayMode !== 'auto'
      ? displayMode
      : listType
        ? listType === 'picture-card' ? 'card' : 'button'
        : isImageOnlyAccept(accept) ? 'card' : 'button'
  const resolvedListType =
    displayMode === 'auto' && listType
      ? listType
      : resolvedDisplayMode === 'card'
        ? 'picture-card'
        : 'text'
  const [fileList, setFileList] = useState<UploadFile[]>(() =>
    normalizeValueToUrls(value, multipleMode).map((url) =>
      toUploadFile(url, resolvedDisplayMode === 'card')
    )
  )
  const fileListRef = useRef(fileList)
  const lastEmittedValueRef = useRef<UploadFormItemValue | undefined>(value)
  const mountedRef = useRef(true)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState<UploadFile>()

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const replaceFileList = useCallback((updater: (current: UploadFile[]) => UploadFile[]) => {
    const current = fileListRef.current
    const nextFileList = updater(current)
    if (nextFileList === current) {
      return current
    }

    fileListRef.current = nextFileList
    setFileList(nextFileList)
    return nextFileList
  }, [])

  useEffect(() => {
    const valueFiles = normalizeValueToUrls(value, multipleMode).map((url) =>
      toUploadFile(url, resolvedDisplayMode === 'card')
    )
    const pendingFiles = isSameUploadValue(value, lastEmittedValueRef.current, multipleMode)
      ? fileListRef.current.filter((item) => item.status === 'uploading')
      : []
    const nextFileList = [
      ...valueFiles,
      ...pendingFiles.filter((pendingFile) => !valueFiles.some((item) => item.uid === pendingFile.uid)),
    ].slice(0, maxCount)
    replaceFileList((current) => areUploadFileListsEqual(current, nextFileList) ? current : nextFileList)
  }, [maxCount, multipleMode, replaceFileList, resolvedDisplayMode, value])

  const emitChange = useCallback(
    (nextFileList: UploadFile[]) => {
      const nextValue = toUploadValue(nextFileList, multipleMode)
      lastEmittedValueRef.current = nextValue
      onChange?.(nextValue)
    },
    [multipleMode, onChange]
  )

  const mergedShowUploadList = useMemo<UploadProps['showUploadList']>(() => {
    if (showUploadList === false) {
      return false
    }

    if (typeof showUploadList === 'object') {
      return {
        ...showUploadList,
        showRemoveIcon: !effectiveDisabled && showUploadList.showRemoveIcon !== false,
      }
    }

    return {
      showPreviewIcon: true,
      showRemoveIcon: !effectiveDisabled,
    }
  }, [effectiveDisabled, showUploadList])

  const handlePreview = useCallback((file: UploadFile) => {
    if (!file.url) {
      return
    }

    setPreviewFile({
      ...file,
      url: normalizeUploadUrl(file.url),
    })
    setPreviewOpen(true)
  }, [])

  const handleRemove = useCallback<NonNullable<UploadProps['onRemove']>>(
    (target) => {
      if (effectiveDisabled) {
        return false
      }

      const nextFileList = replaceFileList((current) => current.filter((item) => item.uid !== target.uid))
      emitChange(nextFileList)
      return true
    },
    [effectiveDisabled, emitChange, replaceFileList]
  )

  const handleCustomRequest = useCallback<NonNullable<UploadProps['customRequest']>>(
    async ({ file, onError, onSuccess }) => {
      const rawFile = file as File & { uid?: string }
      const fileSizeLimitBytes = fileSizeLimitMB * 1024 * 1024
      const fileUid = readUploadFileUid(rawFile)
      const previousFileList = fileListRef.current

      if (rawFile.size > fileSizeLimitBytes) {
        const error = new Error(`文件大小不能超过 ${fileSizeLimitMB}MB。`)
        void message.error(error.message)
        onError?.(error)
        return
      }

      replaceFileList((current) => {
        const uploadingItem: UploadFile = {
          uid: fileUid,
          name: rawFile.name,
          status: 'uploading',
        }
        const withoutCurrentFile = current.filter((item) => item.uid !== fileUid)
        return multipleMode ? [...withoutCurrentFile, uploadingItem].slice(0, maxCount) : [uploadingItem]
      })

      try {
        const uploadedUrl = await uploadFile(rawFile)
        if (!mountedRef.current) {
          return
        }
        if (!uploadedUrl) {
          throw new Error('上传结果缺少文件地址。')
        }

        const doneFile: UploadFile = {
          uid: fileUid,
          name:
            resolvedDisplayMode === 'card' && rawFile.type.startsWith('image/')
              ? ''
              : rawFile.name || readFileNameFromUrl(uploadedUrl),
          status: 'done',
          url: normalizeUploadUrl(uploadedUrl),
        }

        let committed = false
        const nextFileList = replaceFileList((current) => {
          if (!current.some((item) => item.uid === fileUid)) {
            return current
          }

          committed = true
          return multipleMode ? current.map((item) => (item.uid === fileUid ? doneFile : item)) : [doneFile]
        })
        if (committed) {
          emitChange(nextFileList)
          onSuccess?.({ url: uploadedUrl })
        }
      } catch (error) {
        if (!mountedRef.current) {
          return
        }
        const normalized = normalizeUploadError(error)
        let handled = false
        replaceFileList((current) => {
          if (!current.some((item) => item.uid === fileUid)) {
            return current
          }

          handled = true
          return multipleMode ? current.filter((item) => item.uid !== fileUid) : previousFileList
        })
        if (handled) {
          void message.error(normalized.message)
          onError?.(normalized)
        }
      }
    },
    [
      emitChange,
      fileSizeLimitMB,
      maxCount,
      multipleMode,
      replaceFileList,
      resolvedDisplayMode,
      uploadFile,
    ]
  )

  const uploadLimitReached = fileList.length >= maxCount
  const usesDefaultTrigger = children === undefined || children === null
  const shouldShowTrigger =
    !uploadLimitReached || (resolvedDisplayMode === 'button' && usesDefaultTrigger)
  const acceptedTypeText = readAcceptTypes(accept).join('、')
  const defaultButtonTooltip = acceptedTypeText
    ? `支持上传 ${acceptedTypeText} 格式，单个文件大小不超过 ${fileSizeLimitMB}MB`
    : `单个文件大小不超过 ${fileSizeLimitMB}MB`
  const helperText =
    tooltip !== undefined
      ? tooltip
      : resolvedDisplayMode === 'button'
        ? defaultButtonTooltip
        : undefined
  const defaultTrigger =
    resolvedDisplayMode === 'button' ? (
      <Button
        disabled={effectiveDisabled || uploadLimitReached}
        icon={<CloudUploadOutlined aria-hidden />}
      >
        {uploadLimitReached ? `最多上传${maxCount}个文件` : (uploadText ?? '上传文件')}
      </Button>
    ) : (
      <>
        <FileUp
          aria-label={typeof uploadText === 'string' ? uploadText : '上传'}
          color="currentColor"
          size={30}
          strokeWidth={1.5}
        />
        {uploadText}
      </>
    )

  return (
    <>
      <Upload
        {...restProps}
        accept={accept}
        className={classNames(
          'ax-upload-form-item',
          `ax-upload-form-item--${resolvedDisplayMode}`,
          className
        )}
        disabled={effectiveDisabled}
        fileList={fileList}
        listType={resolvedListType}
        maxCount={maxCount}
        showUploadList={mergedShowUploadList}
        beforeUpload={async (file, selectedFiles) => {
          let candidateFile = file
          if (beforeUpload) {
            try {
              const externalResult = await beforeUpload(file, selectedFiles)
              if (externalResult === false || externalResult === Upload.LIST_IGNORE) {
                return externalResult
              }
              if (externalResult instanceof Blob) {
                const transformedFile = new File([externalResult], file.name, {
                  type: externalResult.type || file.type,
                  lastModified: file.lastModified,
                })
                candidateFile = Object.assign(transformedFile, { uid: file.uid }) as RcFile
              }
            } catch {
              return false
            }
          }
          try {
            const nextFile = await compressImage(candidateFile)
            if (nextFile.size > fileSizeLimitMB * 1024 * 1024) {
              void message.error(`文件大小不能超过 ${fileSizeLimitMB}MB。`)
              return false
            }
            return nextFile
          } catch {
            void message.error('图片压缩失败，请重新选择文件。')
            return false
          }
        }}
        customRequest={handleCustomRequest}
        onPreview={handlePreview}
        onRemove={handleRemove}
      >
        {shouldShowTrigger ? children ?? defaultTrigger : null}
      </Upload>
      {helperText ? <div className="mt-2 text-description">{helperText}</div> : null}
      {previewFile?.url ? (
        <Suspense fallback={null}>
          <LazyFilePreview
            title="文件预览"
            source={previewFile.url}
            fileName={previewFile.name}
            contentType={previewFile.type}
            trigger={null}
            open={previewOpen}
            onOpenChange={(open) => {
              setPreviewOpen(open)
              if (!open) {
                setPreviewFile(undefined)
              }
            }}
          />
        </Suspense>
      ) : null}
    </>
  )
}
