import { Alert, Button, Card, Input, Modal, Spin } from 'antd'
import React, { useEffect, useState } from 'react'

import { normalizeApiError } from '../../infrastructure/http/api-client'
import {
  fetchPendingProductReviews,
  fetchProductReview,
  moderateProductReview,
  type ProductReview,
} from '../../services/catalog/api'
import { useI18n } from '../../shared/contexts/i18n-context'
import { CustomPageRecipe } from '../../shared/template-kit/recipes/custom-page-recipe'

import { useFormDialog } from '../../shared/hooks/use-form-dialog'

void React

export function ReviewModerationPage() {
  const { t } = useI18n()
  const [reviews, setReviews] = useState<ProductReview[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [selected, setSelected] = useState<ProductReview | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const dialog = useFormDialog({
    open: selected !== null,
    onClose: () => {
      setSelected(null)
      setReason('')
    },
    getSubmission: () => reason.trim(),
  })

  useEffect(() => {
    let active = true
    void fetchPendingProductReviews()
      .then((page) => {
        if (!active) return
        setReviews(page.items)
        setNextCursor(page.nextCursor)
      })
      .catch((cause) => {
        if (active) setError(normalizeApiError(cause).message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const loadMore = async () => {
    if (!nextCursor || busy) return
    setBusy(true)
    setError(null)
    try {
      const page = await fetchPendingProductReviews(nextCursor)
      setReviews((current) => [
        ...current,
        ...page.items.filter((item) => !current.some((old) => old.id === item.id)),
      ])
      setNextCursor(page.nextCursor)
    } catch (cause) {
      setError(normalizeApiError(cause).message)
    } finally {
      setBusy(false)
    }
  }

  const openReview = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      setSelected(await fetchProductReview(id))
      setReason('')
    } catch (cause) {
      setError(normalizeApiError(cause).message)
    } finally {
      setBusy(false)
    }
  }

  const decide = async (decision: 'approved' | 'rejected') => {
    if (!selected || reason.trim().length < 3 || busy) return
    setBusy(true)
    setError(null)
    try {
      await moderateProductReview(selected.id, decision, reason.trim())
      if (!dialog.isCurrent()) return
      setReviews((current) => current.filter((item) => item.id !== selected.id))
      dialog.complete()
      setNotice(
        decision === 'approved'
          ? t('Review approved. It becomes public after a new Catalog release is deployed.')
          : t('Review rejected.')
      )
    } catch (cause) {
      setError(normalizeApiError(cause).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <CustomPageRecipe title={t('Review moderation')} className="p-4 sm:p-6">
      {error ? <Alert showIcon type="error" title={error} /> : null}
      {notice ? <Alert showIcon type="info" title={notice} /> : null}
      {loading ? <Spin aria-label={t('Loading reviews')} /> : null}
      {!loading && reviews.length === 0 ? <p>{t('No reviews are awaiting moderation.')}</p> : null}
      <div className="grid gap-3">
        {reviews.map((review) => (
          <Card key={review.id} size="small">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="font-medium">
                  {review.displayName} · {review.rating}/5
                </p>
                <p className="text-sm text-gray-600">
                  {review.productId} · {review.submittedAt}
                </p>
                <p className="break-words">{review.body}</p>
              </div>
              <Button disabled={busy} onClick={() => void openReview(review.id)}>
                {t('Review')}
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {nextCursor ? (
        <Button loading={busy} onClick={() => void loadMore()}>
          {t('Load more reviews')}
        </Button>
      ) : null}
      <Modal
        title={t('Moderate review')}
        open={selected !== null}
        footer={null}
        onCancel={dialog.requestClose}
        mask={{ closable: !busy && !dialog.busy }}
        keyboard={!busy && !dialog.busy}
      >
        {selected ? (
          <div className="space-y-3">
            <p>
              {selected.displayName} · {selected.rating}/5
            </p>
            <p className="break-words">{selected.body}</p>
            <label className="block space-y-1">
              <span>{t('Decision reason')}</span>
              <Input.TextArea
                disabled={busy || dialog.busy}
                maxLength={500}
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <p className="text-sm text-gray-600">
              {t(
                'Approval is saved now; the public page changes after a new Catalog release is deployed.'
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="primary"
                disabled={reason.trim().length < 3 || busy || dialog.busy}
                loading={busy || dialog.busy}
                onClick={() => void dialog.submit(() => decide('approved'))}
              >
                {t('Approve')}
              </Button>
              <Button
                danger
                disabled={reason.trim().length < 3 || busy || dialog.busy}
                loading={busy || dialog.busy}
                onClick={() => void dialog.submit(() => decide('rejected'))}
              >
                {t('Reject')}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </CustomPageRecipe>
  )
}
