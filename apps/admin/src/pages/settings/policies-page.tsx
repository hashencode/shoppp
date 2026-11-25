import type { PolicyAuthority, StorefrontContentSection } from '@shoppp/contracts'
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError, type ApiError } from '../../infrastructure/http/api-client'
import {
  createPolicy,
  fetchPolicies,
  reviewPolicy,
  transitionPolicy,
  updatePolicy,
  type PolicyReview,
  type PolicyAuthorityView,
} from '../../services/platform/api'
import { StructuredContentEditor } from '../../shared/content/structured-content-editor'
import { CustomPageRecipe } from '../../shared/template-kit/recipes/custom-page-recipe'
import { useI18n } from '../../shared/contexts/i18n-context'
import { localizeApiError } from '../../shared/i18n/api-error'
import { FormSubmitToolbar } from '../../shared/components/form-submit-toolbar'
import { FORM_CARD_BODY_WIDTH_CLASS_NAME } from '../../shared/template-kit/form/form-content-width'
import { FORM_ERROR_SCROLL_OPTIONS } from '../../shared/template-kit/form/form-validation-scroll'

void React

type Values = {
  effectiveDate: dayjs.Dayjs
  kind: PolicyAuthority['kind']
  reason: string
  sections: StorefrontContentSection[]
  slug: string
  title: string
}
type TransitionContext = {
  action: 'approve' | 'publish' | 'archive'
  id: string
  version: number
  title: string
}

export const PoliciesPage = () => {
  const { t } = useI18n()
  const { permissions, role } = useAuth()
  const canRead = hasPermission(role, 'policies.read', permissions)
  const canWrite = hasPermission(role, 'policies.write', permissions)
  const canApprove = hasPermission(role, 'policies.approve', permissions)
  const canPublish = hasPermission(role, 'policies.publish', permissions)
  const [policies, setPolicies] = useState<PolicyAuthorityView[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [selected, setSelected] = useState<PolicyAuthority | null>(null)
  const [review, setReview] = useState<PolicyReview | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [transitionContext, setTransitionContext] = useState<TransitionContext | null>(null)
  const [transitionError, setTransitionError] = useState<ApiError | null>(null)
  const [transitionForm] = Form.useForm<{ reason: string }>()
  const reviewGeneration = useRef(0)
  const mutationLock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [form] = Form.useForm<Values>()
  const baseline = useRef<Partial<Values>>({})

  const load = useCallback(async (cursor?: string) => {
    try {
      const page = await fetchPolicies(cursor)
      setPolicies((current) => (cursor ? [...current, ...page.items] : page.items))
      setNextCursor(page.nextCursor)
      if (!cursor) {
        setSelected(
          (current) => page.items.find(({ id }) => id === current?.id) ?? page.items[0] ?? null
        )
      }
    } catch (cause) {
      setError(normalizeApiError(cause))
    }
  }, [])

  useEffect(() => {
    if (!canRead) return
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [canRead, load])

  useEffect(() => {
    if (!selected) return
    const values: Values = {
      effectiveDate: dayjs(selected.effectiveDate),
      kind: selected.kind,
      reason: '',
      sections: structuredClone(selected.sections),
      slug: selected.slug,
      title: selected.title,
    }
    baseline.current = values
    form.setFieldsValue(values)
  }, [form, selected])

  const newPolicy = () => {
    reviewGeneration.current += 1
    setTransitionContext(null)
    setSelected(null)
    setReview(null)
    const values: Values = {
      effectiveDate: dayjs(),
      kind: 'privacy',
      reason: '',
      sections: [],
      slug: '',
      title: '',
    }
    baseline.current = values
    form.resetFields()
    form.setFieldsValue(values)
    setError(null)
  }

  const save = async (values: Values) => {
    if (!canWrite || transitionContext || mutationLock.current) return
    mutationLock.current = true
    setBusy(true)
    setError(null)
    try {
      const input = {
        effectiveDate: values.effectiveDate.format('YYYY-MM-DD'),
        kind: values.kind,
        reason: values.reason,
        sections: values.sections,
        slug: values.slug,
        title: values.title,
      }
      const saved = selected
        ? await updatePolicy(selected.id, { ...input, expectedVersion: selected.version })
        : await createPolicy(input)
      setSelected(saved)
      setReview(null)
      await load()
    } catch (cause) {
      setError(normalizeApiError(cause))
    } finally {
      mutationLock.current = false
      setBusy(false)
    }
  }

  const inspect = async (policy: PolicyAuthorityView) => {
    const generation = ++reviewGeneration.current
    setSelected(policy)
    setReview(null)
    setTransitionContext(null)
    try {
      const next = await reviewPolicy(policy.id, policy.version)
      if (generation === reviewGeneration.current) setReview(next)
    } catch (cause) {
      if (generation === reviewGeneration.current) setError(normalizeApiError(cause))
    }
  }

  const openTransition = (action: TransitionContext['action']) => {
    if (
      !review ||
      review.current.id !== selected?.id ||
      review.current.version !== selected?.version ||
      busy ||
      mutationLock.current ||
      !(action === 'approve' ? canApprove : canPublish) ||
      (action === 'approve'
        ? review.current.status !== 'draft'
        : action === 'publish'
          ? review.current.status !== 'approved'
          : review.current.status === 'archived')
    )
      return
    transitionForm.resetFields()
    setTransitionError(null)
    setTransitionContext({
      action,
      id: review.current.id,
      version: review.current.version,
      title: review.current.title,
    })
  }

  const transition = async ({ reason }: { reason: string }) => {
    const context = transitionContext
    if (
      !context ||
      !review ||
      context.id !== selected?.id ||
      context.version !== selected?.version ||
      context.id !== review.current.id ||
      context.version !== review.current.version ||
      reason.trim().length < 3 ||
      reason.trim().length > 500 ||
      mutationLock.current ||
      !(context.action === 'approve' ? canApprove : canPublish) ||
      (context.action === 'approve'
        ? review.current.status !== 'draft'
        : context.action === 'publish'
          ? review.current.status !== 'approved'
          : review.current.status === 'archived')
    )
      return
    mutationLock.current = true
    setBusy(true)
    setTransitionError(null)
    try {
      const updated = await transitionPolicy(context.id, context.action, {
        confirm: true,
        expectedVersion: context.version,
        reason: reason.trim(),
      })
      setTransitionContext(null)
      setSelected(updated)
      setReview(null)
      try {
        setReview(await reviewPolicy(updated.id, updated.version))
      } catch (cause) {
        setError(normalizeApiError(cause))
      }
      await load()
    } catch (cause) {
      const normalized = normalizeApiError(cause)
      if (normalized.code === 'policy_conflict') {
        setError(normalized)
        setTransitionContext(null)
        setReview(null)
        try {
          const latest = await reviewPolicy(context.id)
          setSelected(latest.current)
          setPolicies((current) =>
            current.map((item) => (item.id === latest.current.id ? latest.current : item))
          )
          setReview(latest)
        } catch {
          setReview(null)
        }
      } else setTransitionError(normalized)
    } finally {
      mutationLock.current = false
      setBusy(false)
    }
  }

  return (
    <CustomPageRecipe title={t('Policies')} className="pb-20">
      {!canRead ? (
        <Alert type="error" message={t('Access denied')} />
      ) : (
        <Space orientation="vertical" size="middle" className="w-full">
          {error ? <Alert type="error" message={error.message} /> : null}
          <Card
            title={t('Policy records')}
            extra={
              canWrite ? (
                <Button type="primary" disabled={busy} onClick={newPolicy}>
                  {t('New policy')}
                </Button>
              ) : null
            }
          >
            <List
              dataSource={policies}
              locale={{ emptyText: t('No policies saved') }}
              renderItem={(policy) => (
                <List.Item
                  actions={[
                    <Button key="review" disabled={busy} onClick={() => void inspect(policy)}>
                      {t('Review policy')}
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={policy.title}
                    description={
                      <>
                        <span>{`${t(policy.kind)} · ${t('Version {version}', { version: policy.version })}`}</span>
                        {policy.inclusion?.live || policy.inclusion?.candidate ? (
                          <details>
                            <summary>{t('Version details')}</summary>
                            <Space orientation="vertical">
                              {policy.inclusion.live ? (
                                <Typography.Text>
                                  {t('Deployment history includes this version.')}
                                </Typography.Text>
                              ) : null}
                              {policy.inclusion.candidate ? (
                                <Typography.Text>
                                  {t('Included in a private preview candidate.')}
                                </Typography.Text>
                              ) : null}
                            </Space>
                          </details>
                        ) : null}
                      </>
                    }
                  />
                  <Tag>{t(policy.status)}</Tag>
                </List.Item>
              )}
            />
            {nextCursor ? (
              <Button onClick={() => void load(nextCursor)}>{t('Load more policies')}</Button>
            ) : null}
          </Card>
          {selected || canWrite ? (
            <Card
              title={selected ? t('Edit {title}', { title: selected.title }) : t('Create policy')}
              classNames={{ body: FORM_CARD_BODY_WIDTH_CLASS_NAME.compact }}
            >
              <Form
                form={form}
                disabled={busy || !canWrite}
                layout="vertical"
                scrollToFirstError={FORM_ERROR_SCROLL_OPTIONS}
                onFinish={(values) => void save(values)}
              >
                <Form.Item name="kind" label={t('Policy type')} rules={[{ required: true }]}>
                  <Select
                    disabled={!canWrite}
                    options={['privacy', 'returns', 'shipping', 'terms'].map((value) => ({
                      label: t(value),
                      value,
                    }))}
                  />
                </Form.Item>
                <Form.Item name="title" label={t('Title')} rules={[{ required: true }]}>
                  <Input readOnly={!canWrite} />
                </Form.Item>
                <Form.Item name="slug" label={t('Slug')} rules={[{ required: true }]}>
                  <Input readOnly={!canWrite} />
                </Form.Item>
                <Form.Item
                  name="effectiveDate"
                  label={t('Effective date')}
                  rules={[{ required: true }]}
                >
                  <DatePicker className="w-full" disabled={!canWrite} />
                </Form.Item>
                <Form.Item
                  label={t('Structured content')}
                  name="sections"
                  rules={[{ required: true, type: 'array', min: 1, max: 40 }]}
                >
                  <StructuredContentEditor disabled={!canWrite} />
                </Form.Item>
                {canWrite ? (
                  <Form.Item name="reason" label={t('Notes (optional)')} rules={[{ max: 500 }]}>
                    <Input maxLength={500} />
                  </Form.Item>
                ) : null}
                {canWrite ? (
                  <FormSubmitToolbar
                    submitLabel={t('Save draft')}
                    submitHtmlType="submit"
                    submitLoading={busy}
                    submitDisabled={busy}
                    resetDisabled={busy}
                    onReset={() => {
                      if (mutationLock.current) return
                      form.resetFields()
                      form.setFieldsValue({
                        ...baseline.current,
                        sections: baseline.current.sections
                          ? structuredClone(baseline.current.sections)
                          : undefined,
                      })
                      setError(null)
                    }}
                  />
                ) : null}
              </Form>
            </Card>
          ) : null}
          {review ? (
            <Card
              title={t('Policy review')}
              classNames={{ body: FORM_CARD_BODY_WIDTH_CLASS_NAME.compact }}
            >
              <Space orientation="vertical" className="w-full">
                <Descriptions
                  size="small"
                  column={1}
                  styles={{ content: { overflowWrap: 'anywhere' } }}
                  items={[
                    { key: 'version', label: t('Version'), children: review.current.version },
                    { key: 'digest', label: t('Digest'), children: review.digest },
                    {
                      key: 'effectiveDate',
                      label: t('Effective date'),
                      children: review.current.effectiveDate,
                    },
                  ]}
                />
                {review.previous ? (
                  <Card
                    size="small"
                    title={t('Currently published · version {version}', {
                      version: review.previous.version,
                    })}
                  >
                    <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                      {review.previousRenderedText}
                    </Typography.Paragraph>
                  </Card>
                ) : null}
                <Typography.Text strong>{t('Reviewed version')}</Typography.Text>
                <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                  {review.renderedText}
                </Typography.Paragraph>
                <Typography.Text>
                  {review.previous
                    ? t('Compare the reviewed version with the currently published content above.')
                    : t('No currently published version.')}
                </Typography.Text>
                <Space>
                  {canApprove && review.current.status === 'draft' ? (
                    <Button disabled={busy} onClick={() => openTransition('approve')}>
                      {t('Approve exact version')}
                    </Button>
                  ) : null}
                  {canPublish && review.current.status === 'approved' ? (
                    <Button disabled={busy} onClick={() => openTransition('publish')}>
                      {t('Publish')}
                    </Button>
                  ) : null}
                  {canPublish && review.current.status !== 'archived' ? (
                    <Button danger disabled={busy} onClick={() => openTransition('archive')}>
                      {t('Archive')}
                    </Button>
                  ) : null}
                </Space>
              </Space>
            </Card>
          ) : null}
        </Space>
      )}
      <Modal
        open={Boolean(
          canRead &&
          transitionContext &&
          (transitionContext.action === 'approve' ? canApprove : canPublish) &&
          transitionContext.id === selected?.id &&
          transitionContext.version === selected?.version &&
          transitionContext.version === review?.current.version
        )}
        title={t(
          transitionContext?.action === 'approve'
            ? 'Approve this exact Policy version?'
            : transitionContext?.action === 'publish'
              ? 'Publish this approved Policy version?'
              : 'Archive this Policy version?'
        )}
        okText={t('Confirm')}
        cancelText={t('Cancel')}
        confirmLoading={busy}
        okButtonProps={{ danger: transitionContext?.action === 'archive' }}
        cancelButtonProps={{ disabled: busy }}
        closable={!busy}
        keyboard={!busy}
        mask={{ closable: !busy }}
        forceRender
        onCancel={() => {
          if (!mutationLock.current) setTransitionContext(null)
        }}
        onOk={() => transitionForm.submit()}
      >
        <Typography.Paragraph type="secondary">
          {transitionContext?.title} ·{' '}
          {t('Saved v{version}', { version: transitionContext?.version ?? 0 })}
        </Typography.Paragraph>
        <Typography.Paragraph>
          {t(
            transitionContext?.action === 'approve'
              ? 'The reviewed digest and effective date will be approval-stamped.'
              : transitionContext?.action === 'publish'
                ? 'After publishing, deploy a new storefront version that includes this policy for it to take effect.'
                : 'Linked mutable content must be repaired before archival can complete.'
          )}
        </Typography.Paragraph>
        <Form
          name="policy-transition"
          form={transitionForm}
          layout="vertical"
          disabled={busy}
          onFinish={(values) => void transition(values)}
        >
          <Form.Item
            name="reason"
            label={t('Transition reason')}
            rules={[
              { required: true, transform: (value: string) => value?.trim(), min: 3, max: 500 },
            ]}
          >
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
        </Form>
        {transitionError ? (
          <Alert type="error" showIcon title={localizeApiError(transitionError, t)} />
        ) : null}
      </Modal>
    </CustomPageRecipe>
  )
}
