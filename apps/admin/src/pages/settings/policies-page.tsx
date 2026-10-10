import type { PolicyAuthority, StorefrontContentSection } from '@shoppp/contracts'
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  List,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import React, { useCallback, useEffect, useState } from 'react'

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

void React

type Values = {
  effectiveDate: dayjs.Dayjs
  kind: PolicyAuthority['kind']
  reason: string
  sections: StorefrontContentSection[]
  slug: string
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
  const [transitionReason, setTransitionReason] = useState('')
  const [form] = Form.useForm<Values>()

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
    form.setFieldsValue({
      effectiveDate: dayjs(selected.effectiveDate),
      kind: selected.kind,
      reason: '',
      sections: selected.sections,
      slug: selected.slug,
      title: selected.title,
    })
  }, [form, selected])

  const newPolicy = () => {
    setSelected(null)
    setReview(null)
    form.setFieldsValue({
      effectiveDate: dayjs(),
      kind: 'privacy',
      reason: '',
      sections: [],
      slug: '',
      title: '',
    })
  }

  const save = async (values: Values) => {
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
    }
  }

  const inspect = async (policy: PolicyAuthorityView) => {
    setSelected(policy)
    setReview(null)
    try {
      setReview(await reviewPolicy(policy.id, policy.version))
    } catch (cause) {
      setError(normalizeApiError(cause))
    }
  }

  const transition = async (action: 'approve' | 'publish' | 'archive') => {
    if (!review || transitionReason.trim().length < 3) return
    try {
      const updated = await transitionPolicy(review.current.id, action, {
        confirm: true,
        expectedVersion: review.current.version,
        reason: transitionReason,
      })
      setSelected(updated)
      setReview(await reviewPolicy(updated.id, updated.version))
      setTransitionReason('')
      await load()
    } catch (cause) {
      const normalized = normalizeApiError(cause)
      setError(normalized)
      if (normalized.code === 'policy_conflict') {
        setTransitionReason('')
        try {
          const latest = await reviewPolicy(review.current.id)
          setSelected(latest.current)
          setPolicies((current) =>
            current.map((item) => (item.id === latest.current.id ? latest.current : item))
          )
          setReview(latest)
        } catch {
          setReview(null)
        }
      }
    }
  }

  return (
    <CustomPageRecipe title={t('Policies')}>
      {!canRead ? (
        <Alert type="error" message={t('Access denied')} />
      ) : (
        <Space direction="vertical" size="middle" className="w-full">
          {error ? <Alert type="error" message={error.message} /> : null}
          <Card
            title={t('Policy records')}
            extra={canWrite ? <Button onClick={newPolicy}>{t('New policy')}</Button> : null}
          >
            <List
              dataSource={policies}
              locale={{ emptyText: t('No policies saved') }}
              renderItem={(policy) => (
                <List.Item
                  actions={[
                    <Button key="review" onClick={() => void inspect(policy)}>
                      {t('Review policy')}
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={policy.title}
                    description={`${t(policy.kind)} · ${t('Version {version}', { version: policy.version })} · ${t(policy.inclusion?.live ? 'Deployed to storefront' : policy.inclusion?.candidate ? 'Included in candidate' : 'Not deployed')}`}
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
            >
              <Form form={form} layout="vertical" onFinish={(values) => void save(values)}>
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
                  <DatePicker disabled={!canWrite} />
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
                  <Button type="primary" htmlType="submit">
                    {t('Save draft')}
                  </Button>
                ) : null}
              </Form>
            </Card>
          ) : null}
          {review ? (
            <Card title={t('Review · version {version}', { version: review.current.version })}>
              <Space direction="vertical" className="w-full">
                <Typography.Text>
                  {t('Digest')}: {review.digest}
                </Typography.Text>
                <Typography.Text>
                  {t('Effective date')}: {review.current.effectiveDate}
                </Typography.Text>
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
                <Input
                  aria-label={t('Transition reason')}
                  value={transitionReason}
                  onChange={(event) => setTransitionReason(event.target.value)}
                  placeholder={t('Reason for this transition')}
                />
                <Space>
                  {canApprove && review.current.status === 'draft' ? (
                    <Popconfirm
                      title={t('Approve this exact Policy version?')}
                      description={t(
                        'The reviewed digest and effective date will be approval-stamped.'
                      )}
                      disabled={transitionReason.trim().length < 3}
                      onConfirm={() => void transition('approve')}
                    >
                      <Button disabled={transitionReason.trim().length < 3}>
                        {t('Approve exact version')}
                      </Button>
                    </Popconfirm>
                  ) : null}
                  {canPublish && review.current.status === 'approved' ? (
                    <Popconfirm
                      title={t('Publish this approved Policy version?')}
                      description={t(
                        'After publishing, deploy a new storefront version that includes this policy for it to take effect.'
                      )}
                      disabled={transitionReason.trim().length < 3}
                      onConfirm={() => void transition('publish')}
                    >
                      <Button disabled={transitionReason.trim().length < 3}>{t('Publish')}</Button>
                    </Popconfirm>
                  ) : null}
                  {canPublish && review.current.status !== 'archived' ? (
                    <Popconfirm
                      title={t('Archive this Policy version?')}
                      description={t(
                        'Linked mutable content must be repaired before archival can complete.'
                      )}
                      disabled={transitionReason.trim().length < 3}
                      onConfirm={() => void transition('archive')}
                    >
                      <Button danger disabled={transitionReason.trim().length < 3}>
                        {t('Archive')}
                      </Button>
                    </Popconfirm>
                  ) : null}
                </Space>
              </Space>
            </Card>
          ) : null}
        </Space>
      )}
    </CustomPageRecipe>
  )
}
