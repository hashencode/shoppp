import type { PolicyAuthority, StorefrontContentSection } from '@shoppp/contracts'
import { Alert, Button, Card, DatePicker, Form, Input, List, Popconfirm, Select, Space, Tag, Typography } from 'antd'
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
  const sections = Form.useWatch('sections', form) ?? []

  const load = useCallback(async (cursor?: string) => {
    try {
      const page = await fetchPolicies(cursor)
      setPolicies((current) => cursor ? [...current, ...page.items] : page.items)
      setNextCursor(page.nextCursor)
      if (!cursor) {
        setSelected((current) => page.items.find(({ id }) => id === current?.id) ?? page.items[0] ?? null)
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
          setPolicies((current) => current.map((item) => item.id === latest.current.id ? latest.current : item))
          setReview(latest)
        } catch {
          setReview(null)
        }
      }
    }
  }

  return (
    <CustomPageRecipe title="Policies">
      {!canRead ? <Alert type="error" message="Access denied" /> : (
        <Space direction="vertical" size="middle" className="w-full">
          <Alert type="info" message="Published is not live" description="A published Policy reaches shoppers only after a new candidate Release includes its exact version." />
          {error ? <Alert type="error" message={error.message} /> : null}
          <Card title="Policy records" extra={canWrite ? <Button onClick={newPolicy}>New policy</Button> : null}>
            <List
              dataSource={policies}
              locale={{ emptyText: 'No Policies saved' }}
              renderItem={(policy) => (
                <List.Item actions={[<Button key="review" onClick={() => void inspect(policy)}>Review</Button>]}>
                  <List.Item.Meta title={policy.title} description={`${policy.kind} · version ${policy.version}${policy.inclusion?.live ? ' · live' : policy.inclusion?.candidate ? ' · candidate only' : ' · not included'}`} />
                  <Tag>{policy.status}</Tag>
                </List.Item>
              )}
            />
            {nextCursor ? <Button onClick={() => void load(nextCursor)}>Load more policies</Button> : null}
          </Card>
          {(selected || canWrite) ? (
            <Card title={selected ? `Edit ${selected.title}` : 'Create Policy'}>
              <Form form={form} layout="vertical" onFinish={(values) => void save(values)}>
                <Form.Item name="kind" label="Policy type" rules={[{ required: true }]}><Select disabled={!canWrite} options={['privacy', 'returns', 'shipping', 'terms'].map((value) => ({ label: value, value }))} /></Form.Item>
                <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input readOnly={!canWrite} /></Form.Item>
                <Form.Item name="slug" label="Slug" rules={[{ required: true }]}><Input readOnly={!canWrite} /></Form.Item>
                <Form.Item name="effectiveDate" label="Effective date" rules={[{ required: true }]}><DatePicker disabled={!canWrite} /></Form.Item>
                <Form.Item label="Structured content" required>
                  <StructuredContentEditor disabled={!canWrite} value={sections} onChange={(value) => form.setFieldValue('sections', value)} />
                </Form.Item>
                {canWrite ? <Form.Item name="reason" label="Reason" rules={[{ required: true, min: 3 }]}><Input /></Form.Item> : null}
                {canWrite ? <Button type="primary" htmlType="submit">Save draft</Button> : null}
              </Form>
            </Card>
          ) : null}
          {review ? (
            <Card title={`Exact review · version ${review.current.version}`}>
              <Space direction="vertical" className="w-full">
                <Typography.Text>Digest: {review.digest}</Typography.Text>
                <Typography.Text>Effective date: {review.current.effectiveDate}</Typography.Text>
                {review.previous ? (
                  <Card size="small" title={`Currently published · version ${review.previous.version}`}>
                    <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{review.previousRenderedText}</Typography.Paragraph>
                  </Card>
                ) : null}
                <Typography.Text strong>Reviewed version</Typography.Text>
                <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{review.renderedText}</Typography.Paragraph>
                <Typography.Text>{review.previous ? 'Compare the reviewed version with the currently published content above.' : 'No currently published version.'}</Typography.Text>
                <Input aria-label="Transition reason" value={transitionReason} onChange={(event) => setTransitionReason(event.target.value)} placeholder="Reason for this transition" />
                <Space>
                  {canApprove && review.current.status === 'draft' ? (
                    <Popconfirm
                      title="Approve this exact Policy version?"
                      description="The reviewed digest and effective date will be approval-stamped."
                      disabled={transitionReason.trim().length < 3}
                      onConfirm={() => void transition('approve')}
                    >
                      <Button disabled={transitionReason.trim().length < 3}>Approve exact version</Button>
                    </Popconfirm>
                  ) : null}
                  {canPublish && review.current.status === 'approved' ? (
                    <Popconfirm
                      title="Publish this approved Policy version?"
                      description="Published is not live until a Release includes this exact version."
                      disabled={transitionReason.trim().length < 3}
                      onConfirm={() => void transition('publish')}
                    >
                      <Button disabled={transitionReason.trim().length < 3}>Publish</Button>
                    </Popconfirm>
                  ) : null}
                  {canPublish && review.current.status !== 'archived' ? (
                    <Popconfirm
                      title="Archive this Policy version?"
                      description="Linked mutable content must be repaired before archival can complete."
                      disabled={transitionReason.trim().length < 3}
                      onConfirm={() => void transition('archive')}
                    >
                      <Button danger disabled={transitionReason.trim().length < 3}>Archive</Button>
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
