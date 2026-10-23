import React, { useId, useState } from 'react'
import { Upload } from 'antd'
import type { UploadFile, UploadProps } from 'antd'
import classNames from 'classnames'
import { UploadPresentation, UploadTrigger, type UploadDisplayMode } from './upload-presentation'
import { exceedsFileSize, matchesAcceptedType, readAcceptTypes } from './upload-file-validation'

import { useI18n } from '../contexts/i18n-context'

void React

type PresentationProps = React.AriaAttributes & {
  id?: string
  className?: string
  displayMode?: Exclude<UploadDisplayMode, 'card'>
  uploadText?: React.ReactNode
  uploadHint?: React.ReactNode
  uploadIcon?: React.ReactNode
  children?: React.ReactNode
}

type SelectionIssue = {
  key:
    | 'Select up to {count} files.'
    | 'Unsupported file format. Upload {types} files.'
    | 'The file is empty. Choose another file.'
    | 'File size cannot exceed {size} MB.'
  values?: Record<string, string | number>
}

type LocalOptions = {
  value: File[]
  onChange: (files: File[]) => void
  accept?: UploadProps['accept']
  multiple?: boolean
  maxCount?: number
  fileSizeLimitMB?: number
  disabled?: boolean
  onBeforeSelect?: (files: File[]) => boolean
  onBeforeRemove?: (file: File) => boolean
  onInvalid?: (message: string) => void
}

type LocalProps = PresentationProps & LocalOptions & { nativeUploadProps?: never }
type NativeProps = PresentationProps & {
  nativeUploadProps: UploadProps
} & { [K in keyof LocalOptions]?: never }

export type FilePickerProps = LocalProps | NativeProps

const LocalFilePicker = ({
  value,
  onChange,
  accept,
  multiple,
  maxCount = multiple ? Infinity : 1,
  fileSizeLimitMB,
  disabled,
  onBeforeSelect,
  onBeforeRemove,
  onInvalid,
  displayMode = 'dragger',
  uploadText,
  uploadHint,
  uploadIcon,
  className,
  children,
  id,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  ...aria
}: LocalProps) => {
  const { t } = useI18n()
  const errorId = useId()
  const [error, setError] = useState<SelectionIssue | null>(null)
  const translateIssue = (issue: SelectionIssue) => {
    switch (issue.key) {
      case 'Select up to {count} files.':
        return t('Select up to {count} files.', issue.values)
      case 'Unsupported file format. Upload {types} files.':
        return t('Unsupported file format. Upload {types} files.', issue.values)
      case 'The file is empty. Choose another file.':
        return t('The file is empty. Choose another file.', issue.values)
      case 'File size cannot exceed {size} MB.':
        return t('File size cannot exceed {size} MB.', issue.values)
    }
  }
  const [readFileId] = useState(() => {
    const ids = new WeakMap<File, string>()
    let nextId = 0
    return (file: File) => {
      let uid = ids.get(file)
      if (!uid) {
        uid = `local-file-${++nextId}`
        ids.set(file, uid)
      }
      return uid
    }
  })
  const fileList: UploadFile[] = value.map((file) => ({
    uid: readFileId(file),
    name: file.name,
    size: file.size,
    type: file.type,
    originFileObj: file as UploadFile['originFileObj'],
  }))
  const description =
    [describedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined

  const beforeUpload: NonNullable<UploadProps['beforeUpload']> = (file, selected) => {
    // Ant Design invokes this hook for every item in one selection. Commit the batch once.
    if (file !== selected[0] || disabled || onBeforeSelect?.(selected) === false) {
      return Upload.LIST_IGNORE
    }
    const next = maxCount === 1 ? selected : [...value, ...selected]
    let issue: typeof error =
      next.length > maxCount
        ? { key: 'Select up to {count} files.', values: { count: maxCount } }
        : null
    for (const candidate of selected) {
      if (issue) break
      if (!matchesAcceptedType(candidate, accept)) {
        issue = {
          key: 'Unsupported file format. Upload {types} files.',
          values: { types: readAcceptTypes(accept).join('、') },
        }
      } else if (candidate.size === 0) {
        issue = { key: 'The file is empty. Choose another file.' }
      } else if (fileSizeLimitMB !== undefined && exceedsFileSize(candidate, fileSizeLimitMB)) {
        issue = { key: 'File size cannot exceed {size} MB.', values: { size: fileSizeLimitMB } }
      }
    }
    setError(issue)
    if (issue) onInvalid?.(translateIssue(issue))
    else onChange(next)
    return Upload.LIST_IGNORE
  }

  return (
    <UploadPresentation
      displayMode={displayMode}
      error={error ? translateIssue(error) : null}
      errorId={errorId}
      helperText={displayMode === 'button' ? uploadHint : undefined}
      uploadProps={{
        ...aria,
        id,
        className,
        'aria-invalid': error ? true : invalid,
        'aria-describedby': description,
        accept: {
          format: typeof accept === 'string' ? accept : (accept?.format ?? ''),
          filter: 'native',
        },
        multiple,
        disabled,
        fileList,
        beforeUpload,
        onRemove: (target) => {
          const index = fileList.findIndex((file) => file.uid === target.uid)
          const file = value[index]
          if (file && !disabled && onBeforeRemove?.(file) !== false) {
            setError(null)
            onChange(value.filter((_, position) => position !== index))
          }
          return false
        },
      }}
    >
      {children === undefined ? (
        <UploadTrigger
          displayMode={displayMode}
          text={uploadText ?? (displayMode === 'button' ? t('Choose file') : undefined)}
          icon={uploadIcon}
          hint={uploadHint}
          disabled={disabled}
          describedBy={description}
        />
      ) : (
        children
      )}
    </UploadPresentation>
  )
}

export const FilePicker = (props: FilePickerProps) => {
  if (props.nativeUploadProps !== undefined) {
    const {
      nativeUploadProps,
      displayMode = 'dragger',
      uploadText,
      uploadHint,
      uploadIcon,
      className,
      children,
      id,
      ...aria
    } = props
    return (
      <UploadPresentation
        displayMode={displayMode}
        helperText={displayMode === 'button' ? uploadHint : undefined}
        uploadProps={{
          ...aria,
          ...nativeUploadProps,
          ...(id ? { id } : {}),
          className: classNames(nativeUploadProps.className, className),
        }}
      >
        {children === undefined ? (
          <UploadTrigger
            displayMode={displayMode}
            text={uploadText}
            hint={uploadHint}
            icon={uploadIcon}
            disabled={nativeUploadProps.disabled}
          />
        ) : (
          children
        )}
      </UploadPresentation>
    )
  }
  return <LocalFilePicker {...props} />
}
