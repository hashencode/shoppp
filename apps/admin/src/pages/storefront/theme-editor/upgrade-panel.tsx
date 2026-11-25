import { localizeThemeError } from '../theme-feedback'
import React, { useLayoutEffect, useRef, useState } from 'react'
import type { AdminStorefrontTheme } from '@shoppp/contracts'
import { Alert, Button, Collapse, Form, Input, Modal, Space } from 'antd'
import {
  createStorefrontExperienceMigrationSuccessor,
  dryRunStorefrontExperienceMigration,
  type StorefrontExperienceDraft,
  type StorefrontExperienceMigration,
} from '../../../services/storefront/api'
import { useI18n } from '../../../shared/contexts/i18n-context'

void React
export const EditorUpgradePanel = ({
  draft,
  targets,
  releaseId,
  disabled,
  canApprove,
  onCreated,
}: {
  draft: StorefrontExperienceDraft
  targets: AdminStorefrontTheme[]
  releaseId: string
  disabled: boolean
  canApprove: boolean
  onCreated: (draft: StorefrontExperienceDraft) => void
}) => {
  const { t } = useI18n()
  const [migration, setMigration] = useState<StorefrontExperienceMigration | null>(null)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null)
  const [reason, setReason] = useState('')
  const lock = useRef(false),
    current = useRef(draft)
  useLayoutEffect(() => {
    current.current = draft
  })
  const target = targets[0]
  if (!target) return null
  const begin = async () => {
    if (disabled || lock.current) return
    lock.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await dryRunStorefrontExperienceMigration(
        draft,
        target,
        '',
        releaseId || undefined
      )
      if (current.current.id === draft.id && current.current.version === draft.version) {
        setMigration(result)
        setReason('')
      }
    } catch (cause) {
      setError(cause)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <>
      <Alert
        type="info"
        title={t('Upgrade this theme for visual authoring.')}
        description={
          error ? localizeThemeError(error, t) : `${draft.themeVersion} → ${target.themeVersion}`
        }
        action={
          <Button loading={busy} disabled={disabled} onClick={() => void begin()}>
            {t('Review upgrade')}
          </Button>
        }
      />
      <Modal
        title={t('Review theme upgrade')}
        open={Boolean(
          migration && migration.draftId === draft.id && migration.draftVersion === draft.version
        )}
        confirmLoading={busy}
        keyboard={!busy}
        mask={{ closable: !busy }}
        closable={!busy}
        onCancel={() => {
          if (!lock.current) setMigration(null)
        }}
        okText={t('Create upgraded draft')}
        okButtonProps={{
          disabled:
            disabled ||
            !canApprove ||
            !migration ||
            migration.conflicts.length > 0 ||
            reason.trim().length < 3,
        }}
        onOk={() =>
          void (async () => {
            if (
              lock.current ||
              disabled ||
              !canApprove ||
              !migration ||
              migration.conflicts.length ||
              migration.draftVersion !== current.current.version ||
              reason.trim().length < 3
            )
              return
            lock.current = true
            setBusy(true)
            try {
              const result = await createStorefrontExperienceMigrationSuccessor(
                draft,
                migration,
                reason.trim()
              )
              setMigration(null)
              onCreated(result)
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : t('The theme upgrade could not be prepared.')
              )
            } finally {
              lock.current = false
              setBusy(false)
            }
          })()
        }
      >
        <Space orientation="vertical" className="w-full">
          <span>
            {draft.themeVersion} → {target.themeVersion}
          </span>
          <span>{t('The original draft and immutable versions are retained.')}</span>
          {error ? (
            <Alert
              type="error"
              title={t('The theme upgrade could not be prepared.')}
              description={localizeThemeError(error, t)}
            />
          ) : null}
          {migration?.conflicts.length ? (
            <Alert
              type="warning"
              title={t('Resolve upgrade conflicts before continuing.')}
              description={migration.conflicts
                .map((conflict) => `${conflict.code}: ${conflict.instanceId}`)
                .join('; ')}
            />
          ) : null}
          <Collapse
            items={[
              {
                key: 'changes',
                label: t('Migration changes'),
                children: (
                  <pre className="overflow-auto text-xs">
                    {JSON.stringify(
                      { before: draft.overrides, after: migration?.migratedOverrides },
                      null,
                      2
                    )}
                  </pre>
                ),
              },
            ]}
          />
          <Form layout="vertical" className="w-full">
            <Form.Item label={t('Reason')} required>
              <Input.TextArea
                aria-label={t('Reason')}
                value={reason}
                maxLength={500}
                disabled={busy}
                onChange={(event) => setReason(event.target.value)}
              />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </>
  )
}
