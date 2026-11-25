import { AppstoreOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { AdminStorefrontTheme } from '@shoppp/contracts'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  App,
} from 'antd'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
import { useI18n } from '../../shared/contexts/i18n-context'
import { CustomPageRecipe } from '../../shared/template-kit/recipes/custom-page-recipe'

import { validationStatusMessages } from './theme-feedback'
import { useFormDialog } from '../../shared/hooks/use-form-dialog'
import { DraftLibraryActions } from './theme-editor/draft-library-actions'
import { StorefrontLibraryHistory } from './theme-editor/library-history'

void React

type CreateValues = {
  name: string
  presetId: string
  reason: string
  themeKey: string
}

const themeKey = (theme: AdminStorefrontTheme) => `${theme.id}@${theme.themeVersion}`

export const ThemesPage = () => {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const guideSearch = searchParams.get('from') === 'setup-guide' ? '?from=setup-guide' : ''
  const { t } = useI18n()
  const { permissions, role } = useAuth()
  const canWrite = hasPermission(role, 'themes.write', permissions)
  const [themes, setThemes] = useState<AdminStorefrontTheme[]>([])
  const [drafts, setDrafts] = useState<StorefrontExperienceDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form] = Form.useForm<CreateValues>()
  const createDialog = useFormDialog({
    open: createOpen,
    form,
    onClose: () => setCreateOpen(false),
  })
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
      name: t('My store design'),
      presetId: initialTheme?.presetDefinitions[0]?.id,
      reason: '',
      themeKey: initialTheme ? themeKey(initialTheme) : undefined,
    })
    setCreateOpen(true)
  }

  return (
    <CustomPageRecipe
      title={t('Storefront themes')}
      extra={
        !loading && !error && canWrite && themes.length > 0 ? (
          <Button type="primary" icon={<PlusOutlined aria-hidden />} onClick={() => openCreate()}>
            {t('New experience draft')}
          </Button>
        ) : null
      }
    >
      <StorefrontLibraryHistory />
      {loading ? (
        <QueryStateBlock state="loading" title={t('Loading storefront themes…')} />
      ) : error ? (
        <QueryStateBlock
          state="error"
          title={t('Storefront themes could not be loaded')}
          description={error}
          primaryActionLabel={t('Reload')}
          onPrimaryAction={() => void load()}
        />
      ) : themes.length === 0 ? (
        <QueryStateBlock
          state="empty"
          title={t('No compatible approved theme packages')}
          description={t(
            'A source-controlled package must pass compatibility and release validation before it appears here.'
          )}
          primaryActionLabel={t('Reload')}
          onPrimaryAction={() => void load()}
        />
      ) : (
        <section aria-labelledby="theme-packages-heading">
          <Typography.Title id="theme-packages-heading" level={5}>
            {t('Approved packages')}
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
                        {t('Use package')}
                      </Button>
                    ) : null
                  }
                >
                  <Descriptions
                    size="small"
                    column={1}
                    styles={{ content: { overflowWrap: 'anywhere' } }}
                    items={[
                      {
                        key: 'contract',
                        label: t('Platform contract'),
                        children: theme.platformContractVersion,
                      },
                      {
                        key: 'schema',
                        label: t('Configuration schema'),
                        children: theme.configurationSchemaVersion,
                      },
                      {
                        key: 'pages',
                        label: t('Supported pages'),
                        children: theme.supportedPageTemplates.join(', '),
                      },
                      {
                        key: 'presets',
                        label: t('Presets'),
                        children: theme.presetDefinitions.map(({ label }) => label).join(', '),
                      },
                    ]}
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </section>
      )}

      {!loading && !error ? (
        <section aria-labelledby="theme-drafts-heading">
          <Typography.Title id="theme-drafts-heading" level={5}>
            {t('Experience drafts')}
          </Typography.Title>
          {drafts.length === 0 ? (
            <Empty description={t('No experience drafts yet.')} />
          ) : (
            <ul
              className="rounded-lg border border-solid"
              style={{ borderColor: 'var(--ant-color-border-secondary)' }}
            >
              {drafts.map((draft) => (
                <li
                  key={draft.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-0 border-solid px-4 py-3 [&+li]:border-t"
                  style={{ borderColor: 'var(--ant-color-border-secondary)' }}
                >
                  <div>
                    <Space wrap>
                      <span>{draft.name ?? draft.experienceId}</span>
                      <Tag>
                        {draft.themeId} {draft.themeVersion}
                      </Tag>
                      <Tag>v{draft.version}</Tag>
                      <Tag color={draft.validation?.status === 'valid' ? 'success' : 'default'}>
                        {t(
                          draft.validation
                            ? (validationStatusMessages[draft.validation.status] ??
                                draft.validation.status)
                            : 'Not validated'
                        )}
                      </Tag>
                    </Space>
                    <Typography.Text type="secondary" className="mt-1 block text-sm">
                      {t('Preset')} {draft.presetId} · {t('updated')} {draft.updatedAt}
                    </Typography.Text>
                  </div>
                  <Space wrap>
                    {canWrite ? (
                      <DraftLibraryActions
                        draft={draft}
                        onUpdated={load}
                        onCopy={(draft) => navigate(`/storefront/themes/${draft.id}${guideSearch}`)}
                      />
                    ) : null}
                    <Button
                      type="link"
                      icon={<EditOutlined aria-hidden />}
                      onClick={() => navigate(`/storefront/themes/${draft.id}${guideSearch}`)}
                    >
                      {t(canWrite ? 'Edit' : 'View')}
                    </Button>
                  </Space>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {!loading && !error && !canWrite ? (
        <Alert
          type="info"
          showIcon
          title={t('Read-only theme access')}
          description={t(
            'Your role can inspect compatible packages and drafts but cannot change, preview, or approve them.'
          )}
        />
      ) : null}

      {!loading && !error ? (
        <Modal
          title={t('Create experience draft')}
          open={createOpen}
          okText={t('Create draft')}
          confirmLoading={createDialog.busy}
          onCancel={createDialog.requestClose}
          footer={(_, { OkBtn }) => <OkBtn />}
          mask={{ closable: !createDialog.busy }}
          keyboard={!createDialog.busy}
          onOk={() => form.submit()}
          destroyOnHidden
        >
          <Form<CreateValues>
            form={form}
            layout="vertical"
            onFinish={() =>
              void createDialog.submit(async (values) => {
                const theme = themes.find((candidate) => themeKey(candidate) === values.themeKey)
                if (!theme) return

                try {
                  const draft = await createStorefrontExperienceDraft(
                    theme,
                    values.presetId,
                    values.reason,
                    values.name
                  )
                  if (!createDialog.isCurrent()) return
                  void message.success(t('Experience draft created.'))
                  createDialog.complete()
                  navigate(`/storefront/themes/${draft.id}${guideSearch}`)
                } catch (cause) {
                  void message.error(normalizeApiError(cause).message)
                }
              })
            }
            disabled={createDialog.busy}
          >
            <Form.Item
              name="name"
              label={t('Draft name')}
              rules={[{ required: true, whitespace: true, max: 120 }]}
            >
              <Input maxLength={120} />
            </Form.Item>
            <Form.Item name="themeKey" label={t('Theme package')} rules={[{ required: true }]}>
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
            <Form.Item name="presetId" label={t('Preset')} rules={[{ required: true }]}>
              <Select
                options={(selectedTheme?.presetDefinitions ?? []).map((preset) => ({
                  label: preset.label,
                  value: preset.id,
                }))}
              />
            </Form.Item>
            <Form.Item name="reason" label={t('Notes (optional)')} rules={[{ max: 500 }]}>
              <Input.TextArea rows={3} maxLength={500} />
            </Form.Item>
          </Form>
        </Modal>
      ) : null}
    </CustomPageRecipe>
  )
}
