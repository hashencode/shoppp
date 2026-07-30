import { AppstoreOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { AdminStorefrontTheme } from '@shoppp/contracts'
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { hasPermission } from '../../infrastructure/auth/permissions'
import { normalizeApiError } from '../../infrastructure/http/api-client'
import {
  createStorefrontExperienceDraft,
  fetchStorefrontExperienceDrafts,
  fetchStorefrontThemes,
  type StorefrontExperienceDraft,
} from '../../services/storefront/api'
import { QueryStateBlock } from '../../shared/components/query-state-block'

void React

type CreateValues = {
  presetId: string
  reason: string
  themeKey: string
}

const themeKey = (theme: AdminStorefrontTheme) => `${theme.id}@${theme.themeVersion}`

export const ThemesPage = () => {
  const navigate = useNavigate()
  const { permissions, role } = useAuth()
  const canWrite = hasPermission(role, 'themes.write', permissions)
  const [themes, setThemes] = useState<AdminStorefrontTheme[]>([])
  const [drafts, setDrafts] = useState<StorefrontExperienceDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [form] = Form.useForm<CreateValues>()
  const selectedThemeKey = Form.useWatch('themeKey', form)
  const selectedTheme = useMemo(
    () => themes.find((theme) => themeKey(theme) === selectedThemeKey),
    [selectedThemeKey, themes]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [availableThemes, availableDrafts] = await Promise.all([
        fetchStorefrontThemes(),
        fetchStorefrontExperienceDrafts(),
      ])
      setThemes(availableThemes)
      setDrafts(availableDrafts)
    } catch (cause) {
      setError(normalizeApiError(cause).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const openCreate = (theme?: AdminStorefrontTheme) => {
    const initialTheme = theme ?? themes[0]
    form.setFieldsValue({
      presetId: initialTheme?.presetDefinitions[0]?.id,
      reason: '',
      themeKey: initialTheme ? themeKey(initialTheme) : undefined,
    })
    setCreateOpen(true)
  }

  if (loading) {
    return <QueryStateBlock state="loading" title="Loading storefront themes…" />
  }
  if (error) {
    return (
      <QueryStateBlock
        state="error"
        title="Storefront themes could not be loaded"
        description={error}
        primaryActionLabel="Reload"
        onPrimaryAction={() => void load()}
      />
    )
  }

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Typography.Title level={2} className="!mb-1">
            Storefront themes
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="!mb-0">
            Configure fixture-backed Fashion and Decor experiences. Production keeps its current
            theme.
          </Typography.Paragraph>
        </div>
        {canWrite && themes.length > 0 ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate()}>
            New experience draft
          </Button>
        ) : null}
      </header>

      {themes.length === 0 ? (
        <QueryStateBlock
          state="empty"
          title="No compatible approved theme packages"
          description="A source-controlled package must pass compatibility and release validation before it appears here."
          primaryActionLabel="Reload"
          onPrimaryAction={() => void load()}
        />
      ) : (
        <section aria-labelledby="theme-packages-heading">
          <Typography.Title id="theme-packages-heading" level={4}>
            Approved packages
          </Typography.Title>
          <Row gutter={[16, 16]}>
            {themes.map((theme) => (
              <Col xs={24} lg={12} key={themeKey(theme)}>
                <Card
                  title={
                    <Space>
                      <AppstoreOutlined />
                      <span className="capitalize">{theme.id}</span>
                      <Tag>{theme.themeVersion}</Tag>
                    </Space>
                  }
                  extra={
                    canWrite ? (
                      <Button size="small" onClick={() => openCreate(theme)}>
                        Use package
                      </Button>
                    ) : null
                  }
                >
                  <Space orientation="vertical" size="small">
                    <span>
                      Contract {theme.platformContractVersion} · schema{' '}
                      {theme.configurationSchemaVersion}
                    </span>
                    <span>{theme.supportedPageTemplates.join(', ')}</span>
                    <span>
                      Presets: {theme.presetDefinitions.map(({ label }) => label).join(', ')}
                    </span>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </section>
      )}

      <section aria-labelledby="theme-drafts-heading">
        <Typography.Title id="theme-drafts-heading" level={4}>
          Experience drafts
        </Typography.Title>
        {drafts.length === 0 ? (
          <Empty description="No experience drafts yet." />
        ) : (
          <ul className="divide-y rounded-lg border border-solid border-slate-200">
            {drafts.map((draft) => (
              <li
                key={draft.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <Space wrap>
                    <span>{draft.experienceId}</span>
                    <Tag>
                      {draft.themeId} {draft.themeVersion}
                    </Tag>
                    <Tag>v{draft.version}</Tag>
                    <Tag color={draft.validation?.status === 'valid' ? 'success' : 'default'}>
                      {draft.validation?.status ?? 'not validated'}
                    </Tag>
                  </Space>
                  <div className="mt-1 text-sm text-slate-500">
                    Preset {draft.presetId} · updated {draft.updatedAt}
                  </div>
                </div>
                <Button
                  type="link"
                  icon={<EditOutlined aria-hidden />}
                  onClick={() => navigate(`/storefront/themes/${draft.id}`)}
                >
                  {canWrite ? 'Edit' : 'View'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!canWrite ? (
        <Alert
          type="info"
          showIcon
          title="Read-only theme access"
          description="Your role can inspect compatible packages and drafts but cannot change, preview, or approve them."
        />
      ) : null}

      <Modal
        title="Create experience draft"
        open={createOpen}
        okText="Create draft"
        confirmLoading={creating}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form<CreateValues>
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            const theme = themes.find((candidate) => themeKey(candidate) === values.themeKey)
            if (!theme) return
            setCreating(true)
            try {
              const draft = await createStorefrontExperienceDraft(
                theme,
                values.presetId,
                values.reason
              )
              void message.success('Experience draft created.')
              setCreateOpen(false)
              navigate(`/storefront/themes/${draft.id}`)
            } catch (cause) {
              void message.error(normalizeApiError(cause).message)
            } finally {
              setCreating(false)
            }
          }}
        >
          <Form.Item name="themeKey" label="Theme package" rules={[{ required: true }]}>
            <Select
              options={themes.map((theme) => ({
                label: `${theme.id} ${theme.themeVersion}`,
                value: themeKey(theme),
              }))}
              onChange={(value) => {
                const theme = themes.find((candidate) => themeKey(candidate) === value)
                form.setFieldValue('presetId', theme?.presetDefinitions[0]?.id)
              }}
            />
          </Form.Item>
          <Form.Item name="presetId" label="Preset" rules={[{ required: true }]}>
            <Select
              options={(selectedTheme?.presetDefinitions ?? []).map((preset) => ({
                label: preset.label,
                value: preset.id,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label="Creation reason"
            rules={[{ required: true, min: 3, max: 500 }]}
          >
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </main>
  )
}
