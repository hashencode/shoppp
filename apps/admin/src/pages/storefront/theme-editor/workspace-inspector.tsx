import React from 'react'
import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Tabs,
  Typography,
} from 'antd'
import { ArrowDownOutlined, ArrowUpOutlined, CopyOutlined, DeleteOutlined } from '@ant-design/icons'
import type { PageTemplate, ThemePackage } from '@shoppp/contracts'
import { Link } from 'react-router-dom'
import { useI18n } from '../../../shared/contexts/i18n-context'
import type {
  StorefrontCatalogRelease,
  StorefrontExperienceDraft,
} from '../../../services/storefront/api'
import type { StorefrontEditorResource } from '../storefront-link-editor'
import { EditorSession } from './editor-session'
import { SettingsInspector } from './settings-inspector'
import { EditorReviewPanel } from './review-panel'
import { editorRegionName } from './editor-labels'

void React
const newId = () => `instance-${crypto.randomUUID()}`
const shellSetting = (id: string) => /^(header-|footer-|identity-logo-|announcement)/.test(id)
type Props = {
  session: EditorSession
  themePackage: ThemePackage
  draft: StorefrontExperienceDraft
  template: PageTemplate
  templateId: string
  selection: string
  setSelection: (id: string) => void
  panel: string
  setPanel: (value: string) => void
  canWrite: boolean
  dirty: boolean
  saving: boolean
  sourceReady: boolean
  releaseId: string
  menus: StorefrontCatalogRelease['menus']
  resources: StorefrontEditorResource[]
  issues: Array<{ path: PropertyKey[]; message: string }>
  change: (action: (session: EditorSession) => void) => void
}
export const WorkspaceInspector = ({
  session,
  themePackage,
  draft,
  template,
  templateId,
  selection,
  setSelection,
  panel,
  setPanel,
  canWrite,
  dirty,
  saving,
  sourceReady,
  releaseId,
  menus,
  resources,
  issues,
  change,
}: Props) => {
  const { t } = useI18n()
  const { modal } = App.useApp()
  const loaded = { package: themePackage, draft }
  const selectedRelease = { menus }
  const selectedSection = template?.sections.find(
    (section) => section.id === selection || section.blocks.some(({ id }) => id === selection)
  )
  const selectedBlock = selectedSection?.blocks.find(({ id }) => id === selection)
  const instance = selectedBlock ?? selectedSection
  const sectionDefinition = loaded?.package.manifest.componentRegistry.sections.find(
    ({ type }) => type === selectedSection?.type
  )
  const blockRule = sectionDefinition?.blockRules?.find(
    (rule) => rule.blockType === selectedBlock?.type
  )
  const blockCount =
    selectedSection?.blocks.filter((block) => block.type === selectedBlock?.type).length ?? 0
  const definition = selectedBlock
    ? loaded?.package.manifest.componentRegistry.blocks.find(
        ({ type }) => type === selectedBlock.type
      )
    : sectionDefinition
  const move = (direction: -1 | 1) =>
    change((session) =>
      session.change((doc) => {
        const template = doc.templates.find(({ id }) => id === templateId)!
        const section = template.sections.find(
          (section) => section.id === selection || section.blocks.some(({ id }) => id === selection)
        )!
        const items = selectedBlock ? section.blocks : template.sections
        const index = items.findIndex(({ id }) => id === selection),
          target = index + direction
        if (index >= 0 && target >= 0 && target < items.length)
          [items[index], items[target]] = [items[target]!, items[index]!]
      })
    )
  const definitions = definition?.settings.filter((setting) => !shellSetting(setting.id)) ?? []
  const fieldErrors = Object.fromEntries(
    issues.flatMap((issue) => {
      const templateIndex = Number(issue.path[3])
      const currentTemplate = session.document.templates[templateIndex]
      const sectionIndex = issue.path.indexOf('sections')
      const blockIndex = issue.path.indexOf('blocks')
      const errorSection =
        sectionIndex >= 0
          ? currentTemplate?.sections[Number(issue.path[sectionIndex + 1])]
          : undefined
      const errorInstance =
        blockIndex >= 0 ? errorSection?.blocks[Number(issue.path[blockIndex + 1])] : errorSection
      return ((selection === '__header' && issue.path.includes('shell')) ||
        errorInstance?.id === selection) &&
        issue.path.includes('settings')
        ? [[String(issue.path.at(-1)), issue.message]]
        : []
    })
  )

  return (
    <aside className="theme-editor-inspector">
      <Card size="small">
        <Tabs
          activeKey={panel}
          onChange={setPanel}
          items={[
            {
              key: 'structure',
              label: t('Settings'),
              children:
                selection === '__styles' ? (
                  <Form layout="vertical" component="div">
                    {(['accent', 'background', 'text'] as const).map((key) => (
                      <Form.Item
                        key={key}
                        htmlFor={`editor-style-${key}`}
                        validateStatus={
                          issues.some(
                            (issue) => issue.path.includes('styles') && issue.path.includes(key)
                          )
                            ? 'error'
                            : undefined
                        }
                        help={
                          issues.some(
                            (issue) => issue.path.includes('styles') && issue.path.includes(key)
                          ) ? (
                            <span id={`editor-style-${key}-error`}>
                              {t('Enter a valid color such as #123456.')}
                            </span>
                          ) : undefined
                        }
                        label={t(
                          key === 'accent'
                            ? 'Accent color'
                            : key === 'background'
                              ? 'Background color'
                              : 'Text color'
                        )}
                      >
                        <Input
                          id={`editor-style-${key}`}
                          aria-describedby={
                            issues.some(
                              (issue) => issue.path.includes('styles') && issue.path.includes(key)
                            )
                              ? `editor-style-${key}-error`
                              : undefined
                          }
                          aria-label={t(
                            key === 'accent'
                              ? 'Accent color'
                              : key === 'background'
                                ? 'Background color'
                                : 'Text color'
                          )}
                          aria-invalid={Boolean(
                            issues.some(
                              (issue) => issue.path.includes('styles') && issue.path.includes(key)
                            )
                          )}
                          disabled={!canWrite || session.schemaVersion < 4}
                          value={template.styles?.[key] ?? ''}
                          placeholder="#123456"
                          onChange={(event) =>
                            change((session) =>
                              session.change((doc) => {
                                for (const template of doc.templates)
                                  template.styles = {
                                    ...template.styles,
                                    [key]: event.target.value || undefined,
                                  }
                              })
                            )
                          }
                        />
                      </Form.Item>
                    ))}
                    <Form.Item label={t('Font')} htmlFor="editor-style-font">
                      <Select
                        id="editor-style-font"
                        aria-label={t('Font')}
                        disabled={!canWrite || session.schemaVersion < 4}
                        value={template.styles?.font ?? 'figtree'}
                        options={['figtree', 'outfit'].map((value) => ({
                          label: value,
                          value,
                        }))}
                        onChange={(font) =>
                          change((session) =>
                            session.change((doc) => {
                              for (const template of doc.templates)
                                template.styles = { ...template.styles, font }
                            })
                          )
                        }
                      />
                    </Form.Item>
                    {(['spacing', 'buttonRadius'] as const).map((key) => (
                      <Form.Item
                        key={key}
                        label={t(key === 'spacing' ? 'Section spacing' : 'Button radius')}
                      >
                        <InputNumber
                          aria-label={t(key === 'spacing' ? 'Section spacing' : 'Button radius')}
                          className="w-full"
                          disabled={!canWrite || session.schemaVersion < 4}
                          min={0}
                          max={key === 'spacing' ? 80 : 40}
                          value={template.styles?.[key]}
                          onChange={(value) => {
                            change((session) =>
                              session.change((doc) => {
                                for (const template of doc.templates)
                                  template.styles = {
                                    ...template.styles,
                                    [key]: value ?? undefined,
                                  }
                              })
                            )
                          }}
                        />
                      </Form.Item>
                    ))}
                  </Form>
                ) : selection === '__header' ? (
                  template.shell ? (
                    <SettingsInspector
                      instanceId="shared-shell"
                      menus={selectedRelease?.menus}
                      onClear={(settingId) =>
                        change((session) =>
                          session.change((doc) => {
                            for (const template of doc.templates)
                              if (template.shell) delete template.shell.settings[settingId]
                          })
                        )
                      }
                      errors={fieldErrors}
                      definitions={loaded.package.manifest.shellSettings ?? []}
                      settings={template.shell.settings}
                      bindings={session.document.bindings}
                      resources={resources}
                      releaseId={releaseId}
                      disabled={!canWrite}
                      block={false}
                      onChange={(settingId, value) =>
                        change((session) =>
                          session.change((doc) => {
                            for (const template of doc.templates)
                              if (template.shell) template.shell.settings[settingId] = value
                          })
                        )
                      }
                      onReference={() => undefined}
                    />
                  ) : (
                    <Typography.Paragraph>
                      {t('Upgrade this theme to edit shared header and footer presentation.')}
                    </Typography.Paragraph>
                  )
                ) : instance && definition ? (
                  <>
                    <Typography.Title level={5}>
                      {selectedBlock
                        ? t(editorRegionName(selectedBlock.type))
                        : (sectionDefinition?.authoring?.label ??
                          t(editorRegionName(instance.type)))}
                    </Typography.Title>
                    <Space wrap className="mb-4">
                      <Button
                        aria-label={t('Move up')}
                        icon={<ArrowUpOutlined aria-hidden />}
                        disabled={
                          !canWrite ||
                          (selectedBlock ? selectedSection!.blocks : template.sections).findIndex(
                            ({ id }) => id === selection
                          ) <= 0
                        }
                        onClick={() => move(-1)}
                      />
                      <Button
                        aria-label={t('Move down')}
                        icon={<ArrowDownOutlined aria-hidden />}
                        disabled={
                          !canWrite ||
                          (selectedBlock ? selectedSection!.blocks : template.sections).findIndex(
                            ({ id }) => id === selection
                          ) >=
                            (selectedBlock
                              ? selectedSection!.blocks.length
                              : template.sections.length) -
                              1
                        }
                        onClick={() => move(1)}
                      />
                      <Switch
                        aria-label={t('Visible')}
                        checked={instance.visible}
                        disabled={!canWrite || Boolean('required' in instance && instance.required)}
                        onChange={(visible) =>
                          change((session) =>
                            session.change((doc) => {
                              const section = doc.templates
                                .find(({ id }) => id === templateId)!
                                .sections.find(
                                  (section) =>
                                    section.id === selection ||
                                    section.blocks.some(({ id }) => id === selection)
                                )!
                              const instance =
                                section.id === selection
                                  ? section
                                  : section.blocks.find(({ id }) => id === selection)!
                              instance.visible = visible
                            })
                          )
                        }
                      />
                      <Button
                        aria-label={t('Duplicate')}
                        icon={<CopyOutlined aria-hidden />}
                        disabled={
                          !canWrite ||
                          Boolean(selectedBlock && blockRule && blockCount >= blockRule.max) ||
                          (!selectedBlock &&
                            (!sectionDefinition?.authoring ||
                              template.sections.filter(({ type }) => type === instance.type)
                                .length >= sectionDefinition.authoring.maxInstances))
                        }
                        onClick={() =>
                          change((session) => {
                            if (!selectedBlock)
                              setSelection(session.duplicateSection(templateId, selection))
                            else
                              session.change((doc) => {
                                const section = doc.templates
                                  .find(({ id }) => id === templateId)!
                                  .sections.find(({ id }) => id === selectedSection!.id)!
                                const block = structuredClone(selectedBlock)
                                block.id = newId()
                                doc.bindings.push(
                                  ...doc.bindings
                                    .filter((binding) => binding.instanceId === selectedBlock.id)
                                    .map((binding) => ({
                                      ...structuredClone(binding),
                                      id: `binding-${crypto.randomUUID()}`,
                                      instanceId: block.id,
                                    }))
                                )
                                section.blocks.splice(
                                  section.blocks.findIndex(({ id }) => id === selection) + 1,
                                  0,
                                  block
                                )
                                setSelection(block.id)
                              })
                          })
                        }
                      />
                      <Button
                        danger
                        aria-label={t('Remove')}
                        icon={<DeleteOutlined aria-hidden />}
                        disabled={
                          !canWrite ||
                          Boolean('required' in instance && instance.required) ||
                          Boolean(selectedBlock && blockRule && blockCount <= blockRule.min) ||
                          (!selectedBlock && session.schemaVersion < 4)
                        }
                        onClick={() =>
                          modal.confirm({
                            title: t('Remove this region?'),
                            onOk: () =>
                              change((session) => {
                                if (!selectedBlock) session.removeSection(templateId, selection)
                                else
                                  session.change((doc) => {
                                    const section = doc.templates
                                      .find(({ id }) => id === templateId)!
                                      .sections.find(({ id }) => id === selectedSection!.id)!
                                    section.blocks = section.blocks.filter(
                                      ({ id }) => id !== selection
                                    )
                                    doc.bindings = doc.bindings.filter(
                                      ({ instanceId }) => instanceId !== selection
                                    )
                                  })
                                setSelection(
                                  selectedBlock
                                    ? selectedSection!.id
                                    : (session.document.templates.find(
                                        ({ id }) => id === templateId
                                      )?.sections[0]?.id ?? '__header')
                                )
                              }),
                          })
                        }
                      />
                    </Space>
                    <SettingsInspector
                      errors={fieldErrors}
                      onClear={(settingId) =>
                        change((session) =>
                          session.change((doc) => {
                            const section = doc.templates
                              .find(({ id }) => id === templateId)!
                              .sections.find(
                                (section) =>
                                  section.id === instance.id ||
                                  section.blocks.some(({ id }) => id === instance.id)
                              )!
                            const target =
                              section.id === instance.id
                                ? section
                                : section.blocks.find(({ id }) => id === instance.id)!
                            delete target.settings[settingId]
                            doc.bindings = doc.bindings.filter(
                              (binding) =>
                                !(
                                  binding.kind === 'catalog' &&
                                  binding.instanceId === instance.id &&
                                  binding.settingId === settingId
                                )
                            )
                          })
                        )
                      }
                      key={instance.id}
                      instanceId={instance.id}
                      definitions={definitions}
                      settings={instance.settings}
                      bindings={session.document.bindings}
                      resources={resources}
                      releaseId={releaseId}
                      disabled={!canWrite}
                      block={Boolean(selectedBlock)}
                      onChange={(settingId, value, group) =>
                        change((session) =>
                          session.setSetting(templateId, instance.id, settingId, value, group)
                        )
                      }
                      onReference={(settingId, kind, id) =>
                        change((session) =>
                          session.change((doc) => {
                            doc.bindings = doc.bindings.filter(
                              (binding) =>
                                !(
                                  binding.instanceId === instance.id &&
                                  binding.kind === 'catalog' &&
                                  binding.settingId === settingId
                                )
                            )
                            if (id)
                              doc.bindings.push({
                                id: `binding-${crypto.randomUUID()}`,
                                kind: 'catalog',
                                instanceId: instance.id,
                                settingId,
                                reference: { kind, id },
                              })
                          })
                        )
                      }
                    />
                    {!selectedBlock ? (
                      <Select
                        aria-label={t('Add block')}
                        placeholder={t('Add block')}
                        value={undefined}
                        disabled={!canWrite}
                        className="w-full"
                        options={(sectionDefinition?.allowedBlockTypes ?? [])
                          .filter((type) => {
                            const rule = sectionDefinition?.blockRules?.find(
                              (rule) => rule.blockType === type
                            )
                            return (
                              !rule ||
                              selectedSection!.blocks.filter((block) => block.type === type)
                                .length < rule.max
                            )
                          })
                          .map((type) => ({
                            label: t(editorRegionName(type)),
                            value: type,
                          }))}
                        onChange={(type: string) =>
                          change((session) =>
                            session.change((doc) => {
                              const definition =
                                loaded.package.manifest.componentRegistry.blocks.find(
                                  (block) => block.type === type
                                )!
                              const block = {
                                id: newId(),
                                type,
                                visible: true,
                                actions: [],
                                capabilities: definition.capabilities,
                                settings: Object.fromEntries(
                                  definition.settings.flatMap((setting) =>
                                    'default' in setting && setting.default !== undefined
                                      ? [[setting.id, setting.default]]
                                      : []
                                  )
                                ),
                              }
                              doc.templates
                                .find(({ id }) => id === templateId)!
                                .sections.find(({ id }) => id === selectedSection!.id)!
                                .blocks.push(block)
                              setSelection(block.id)
                            })
                          )
                        }
                      />
                    ) : null}
                  </>
                ) : (
                  <Typography.Paragraph>
                    {t('Select a region in the preview or structure tree.')}
                  </Typography.Paragraph>
                ),
            },
            {
              key: 'review',
              label: t('Review and publish'),
              children: (
                <EditorReviewPanel
                  draft={loaded.draft}
                  releaseId={releaseId}
                  dirty={dirty || saving}
                  sourceReady={sourceReady}
                  onSelect={(id) => {
                    setSelection(id)
                    setPanel('structure')
                  }}
                />
              ),
            },
          ]}
        />
      </Card>
      <Space wrap className="mt-3">
        <Link to="/catalog/products" target="_blank" rel="noopener">
          {t('Manage products')}
        </Link>
        <Link to="/content/pages" target="_blank" rel="noopener">
          {t('Manage content')}
        </Link>
        <Link to="/storefront/navigation" target="_blank" rel="noopener">
          {t('Manage navigation')}
        </Link>
      </Space>
    </aside>
  )
}
