import type { StorefrontContentSection } from '@shoppp/contracts'
import { Button, Card, Input, Select, Space } from 'antd'
import React from 'react'

import { useI18n } from '../contexts/i18n-context'
import { ContentMediaSelect } from './content-media-select'

void React

type Props = Pick<
  React.HTMLAttributes<HTMLDivElement>,
  'id' | 'aria-describedby' | 'aria-invalid' | 'aria-required'
> & {
  contentMode?: 'policy' | 'publishable'
  disabled?: boolean
  onChange?: (value: StorefrontContentSection[]) => void
  value?: StorefrontContentSection[]
}

const sectionId = () => `section.${crypto.randomUUID()}`
const sectionKindLabel: Record<StorefrontContentSection['kind'], string> = {
  heading: 'Heading',
  image: 'Image',
  link: 'Link',
  list: 'List',
  paragraph: 'Paragraph',
}

export const StructuredContentEditor = ({
  contentMode = 'policy',
  disabled = false,
  onChange = () => undefined,
  value = [],
  ...fieldProps
}: Props) => {
  const { t } = useI18n()
  const replace = (index: number, section: StorefrontContentSection) =>
    onChange(value.map((item, itemIndex) => (itemIndex === index ? section : item)))
  const append = (kind: StorefrontContentSection['kind']) => {
    const id = sectionId()
    const section: StorefrontContentSection =
      kind === 'heading'
        ? { id, kind, level: 2, text: '' }
        : kind === 'paragraph'
          ? { id, kind, text: '' }
          : kind === 'list'
            ? { id, kind, items: [''] }
            : kind === 'image'
              ? { alt: '', assetId: '', id, kind }
              : {
                  id,
                  kind,
                  link: {
                    label: '',
                    target: { kind: 'external', url: '' },
                    targetBehavior: 'same-window',
                  },
                }
    onChange([...value, section])
  }
  return (
    <Space
      {...fieldProps}
      role="group"
      aria-label={t('Structured content')}
      orientation="vertical"
      className="w-full"
      size="middle"
    >
      <Space wrap>
        {(contentMode === 'publishable'
          ? (['heading', 'paragraph', 'image', 'link'] as const)
          : (['heading', 'paragraph', 'list', 'image', 'link'] as const)
        ).map((kind) => (
          <Button key={kind} disabled={disabled || value.length >= 40} onClick={() => append(kind)}>
            {t('Add {kind}', { kind: t(sectionKindLabel[kind]) })}
          </Button>
        ))}
      </Space>
      {value.map((section, index) => (
        <Card
          key={section.id}
          size="small"
          title={`${index + 1}. ${t(sectionKindLabel[section.kind])}`}
          extra={
            <Button
              danger
              disabled={disabled}
              onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
            >
              {t('Remove')}
            </Button>
          }
        >
          {section.kind === 'heading' ? (
            <Space orientation="vertical" className="w-full">
              <Select
                aria-label={t('Heading level {index}', { index: index + 1 })}
                disabled={disabled}
                value={section.level}
                options={[2, 3].map((level) => ({ label: `H${level}`, value: level }))}
                onChange={(level) => replace(index, { ...section, level })}
              />
              <Input
                aria-label={t('Heading text {index}', { index: index + 1 })}
                disabled={disabled}
                maxLength={200}
                value={section.text}
                onChange={(event) => replace(index, { ...section, text: event.target.value })}
              />
            </Space>
          ) : section.kind === 'paragraph' ? (
            <Input.TextArea
              aria-label={t('Paragraph {index}', { index: index + 1 })}
              disabled={disabled}
              maxLength={5000}
              rows={4}
              value={section.text}
              onChange={(event) => replace(index, { ...section, text: event.target.value })}
            />
          ) : section.kind === 'list' ? (
            <Input.TextArea
              aria-label={t('List {index}', { index: index + 1 })}
              disabled={disabled}
              rows={4}
              value={section.items.join('\n')}
              onChange={(event) =>
                replace(index, {
                  ...section,
                  items: event.target.value
                    .split('\n')
                    .slice(0, 20)
                    .map((item) => item.slice(0, 500)),
                })
              }
            />
          ) : section.kind === 'image' ? (
            <Space orientation="vertical" className="w-full">
              <ContentMediaSelect
                disabled={disabled}
                value={section.assetId}
                onChange={(assetId) => replace(index, { ...section, assetId: assetId ?? '' })}
              />
              <Input
                aria-label={t('Image alternative text {index}', { index: index + 1 })}
                disabled={disabled}
                maxLength={300}
                value={section.alt}
                onChange={(event) => replace(index, { ...section, alt: event.target.value })}
              />
            </Space>
          ) : (
            <Space orientation="vertical" className="w-full">
              <Input
                aria-label={t('Link label {index}', { index: index + 1 })}
                disabled={disabled}
                maxLength={120}
                value={section.link.label}
                onChange={(event) =>
                  replace(index, {
                    ...section,
                    link: { ...section.link, label: event.target.value },
                  })
                }
              />
              <Select
                aria-label={t('Link target type {index}', { index: index + 1 })}
                disabled={disabled}
                value={section.link.target.kind}
                options={[
                  { label: t('Internal resource'), value: 'internal' },
                  { label: t('External HTTPS'), value: 'external' },
                ]}
                onChange={(kind: 'external' | 'internal') =>
                  replace(index, {
                    ...section,
                    link: {
                      ...section.link,
                      target:
                        kind === 'external'
                          ? { kind, url: '' }
                          : { kind, reference: { id: 'page.placeholder', kind: 'page' } },
                    },
                  })
                }
              />
              {section.link.target.kind === 'external' ? (
                <Input
                  aria-label={t('External URL {index}', { index: index + 1 })}
                  disabled={disabled}
                  placeholder="https://example.com/path"
                  value={section.link.target.url}
                  onChange={(event) =>
                    replace(index, {
                      ...section,
                      link: {
                        ...section.link,
                        target: { kind: 'external', url: event.target.value },
                      },
                    })
                  }
                />
              ) : (
                <Space.Compact className="w-full">
                  <Select
                    aria-label={t('Internal resource kind {index}', { index: index + 1 })}
                    disabled={disabled}
                    value={section.link.target.reference.kind}
                    options={['product', 'collection', 'page', 'article', 'policy'].map((kind) => ({
                      label: kind,
                      value: kind,
                    }))}
                    onChange={(kind) =>
                      replace(index, {
                        ...section,
                        link: {
                          ...section.link,
                          target: {
                            kind: 'internal',
                            reference: {
                              id: `${kind}.placeholder`,
                              kind,
                            } as typeof section.link.target.reference,
                          },
                        },
                      })
                    }
                  />
                  <Input
                    aria-label={t('Internal resource ID {index}', { index: index + 1 })}
                    disabled={disabled}
                    value={section.link.target.reference.id}
                    onChange={(event) =>
                      replace(index, {
                        ...section,
                        link: {
                          ...section.link,
                          target: {
                            kind: 'internal',
                            reference: {
                              ...('reference' in section.link.target
                                ? section.link.target.reference
                                : { id: 'page.placeholder', kind: 'page' as const }),
                              id: event.target.value,
                            },
                          },
                        },
                      })
                    }
                  />
                </Space.Compact>
              )}
              <Select
                aria-label={t('Link window {index}', { index: index + 1 })}
                disabled={disabled}
                value={section.link.targetBehavior}
                options={[
                  { label: t('Same window'), value: 'same-window' },
                  { label: t('New window'), value: 'new-window' },
                ]}
                onChange={(targetBehavior) =>
                  replace(index, {
                    ...section,
                    link: { ...section.link, targetBehavior },
                  })
                }
              />
            </Space>
          )}
        </Card>
      ))}
    </Space>
  )
}
