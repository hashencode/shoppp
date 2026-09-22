import type { StorefrontContentSection } from '@shoppp/contracts'
import { Button, Card, Input, Select, Space } from 'antd'
import React from 'react'

void React

type Props = {
  disabled?: boolean
  onChange: (value: StorefrontContentSection[]) => void
  value: StorefrontContentSection[]
}

const sectionId = () => `section.${crypto.randomUUID()}`

export const StructuredContentEditor = ({ disabled = false, onChange, value = [] }: Props) => {
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
            : { alt: '', assetId: '', id, kind }
    onChange([...value, section])
  }
  return (
    <Space direction="vertical" className="w-full" size="middle">
      <Space wrap>
        {(['heading', 'paragraph', 'list', 'image'] as const).map((kind) => (
          <Button key={kind} disabled={disabled || value.length >= 40} onClick={() => append(kind)}>
            Add {kind}
          </Button>
        ))}
      </Space>
      {value.map((section, index) => (
        <Card
          key={section.id}
          size="small"
          title={`${index + 1}. ${section.kind}`}
          extra={
            <Button
              danger
              disabled={disabled}
              onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
            >
              Remove
            </Button>
          }
        >
          {section.kind === 'heading' ? (
            <Space direction="vertical" className="w-full">
              <Select
                aria-label={`Heading level ${index + 1}`}
                disabled={disabled}
                value={section.level}
                options={[2, 3].map((level) => ({ label: `H${level}`, value: level }))}
                onChange={(level) => replace(index, { ...section, level })}
              />
              <Input
                aria-label={`Heading text ${index + 1}`}
                disabled={disabled}
                maxLength={200}
                value={section.text}
                onChange={(event) => replace(index, { ...section, text: event.target.value })}
              />
            </Space>
          ) : section.kind === 'paragraph' ? (
            <Input.TextArea
              aria-label={`Paragraph ${index + 1}`}
              disabled={disabled}
              maxLength={5000}
              rows={4}
              value={section.text}
              onChange={(event) => replace(index, { ...section, text: event.target.value })}
            />
          ) : section.kind === 'list' ? (
            <Input.TextArea
              aria-label={`List ${index + 1}`}
              disabled={disabled}
              rows={4}
              value={section.items.join('\n')}
              onChange={(event) =>
                replace(index, {
                  ...section,
                  items: event.target.value.split('\n').slice(0, 20).map((item) => item.slice(0, 500)),
                })
              }
            />
          ) : (
            <Space direction="vertical" className="w-full">
              <Input
                aria-label={`Image asset ID ${index + 1}`}
                disabled={disabled}
                placeholder="Approved asset ID"
                value={section.assetId}
                onChange={(event) => replace(index, { ...section, assetId: event.target.value })}
              />
              <Input
                aria-label={`Image alternative text ${index + 1}`}
                disabled={disabled}
                maxLength={300}
                value={section.alt}
                onChange={(event) => replace(index, { ...section, alt: event.target.value })}
              />
            </Space>
          )}
        </Card>
      ))}
    </Space>
  )
}
