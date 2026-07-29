import type { AuditEvent, AuditQuery } from '@shoppp/contracts'
import { Button, Input, Select, Space, Table, Tag, message } from 'antd'
import dayjs from 'dayjs'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { normalizeApiError } from '../../infrastructure/http/api-client'
import { fetchAuditEvents } from '../../services/platform/api'

void React

export const AuditPage = () => {
  const [items, setItems] = useState<AuditEvent[]>([])
  const [filters, setFilters] = useState<AuditQuery>({ pageSize: 25 })
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(
    async (nextCursor?: string) => {
      setLoading(true)
      try {
        const result = await fetchAuditEvents({
          ...filters,
          ...(nextCursor ? { cursor: nextCursor } : {}),
        })
        setItems(result.data)
        setCursor(result.nextCursor)
      } catch (error) {
        void message.error(normalizeApiError(error).message)
      } finally {
        setLoading(false)
      }
    },
    [filters]
  )

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const columns = useMemo(
    () => [
      {
        key: 'created',
        title: 'Time',
        dataIndex: 'createdAt',
        width: 180,
        render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
      },
      { key: 'action', title: 'Action', dataIndex: 'action', width: 220 },
      {
        key: 'result',
        title: 'Result',
        dataIndex: 'result',
        width: 110,
        render: (value: string) => (
          <Tag color={value === 'failed' || value === 'denied' ? 'error' : 'success'}>{value}</Tag>
        ),
      },
      {
        key: 'actor',
        title: 'Actor',
        dataIndex: 'actorId',
        width: 200,
        render: (value: string | null) => value ?? 'system',
      },
      {
        key: 'target',
        title: 'Target',
        width: 260,
        render: (_: unknown, item: AuditEvent) =>
          `${item.targetType}${item.targetId ? ` · ${item.targetId}` : ''}`,
      },
      {
        key: 'reason',
        title: 'Reason',
        dataIndex: 'reason',
        width: 300,
        render: (value: string | null) => value ?? '—',
      },
      {
        key: 'request',
        title: 'Request ID',
        dataIndex: 'requestId',
        width: 280,
        render: (value: string | null) => value ?? '—',
      },
    ],
    []
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Audit trail</h1>
        <p className="text-slate-500">
          Redacted, permissioned records with stable cursor pagination.
        </p>
      </div>
      <Space wrap>
        <Input
          aria-label="Filter audit action"
          placeholder="Exact action"
          className="w-56"
          allowClear
          onChange={(event) =>
            setFilters((current) => ({ ...current, action: event.target.value || undefined }))
          }
        />
        <Input
          aria-label="Filter audit target"
          placeholder="Target type"
          className="w-48"
          allowClear
          onChange={(event) =>
            setFilters((current) => ({ ...current, targetType: event.target.value || undefined }))
          }
        />
        <Select
          aria-label="Filter audit result"
          className="w-40"
          allowClear
          placeholder="Result"
          options={['allowed', 'denied', 'succeeded', 'failed'].map((value) => ({ value }))}
          onChange={(result) => setFilters((current) => ({ ...current, result }))}
        />
        <Button onClick={() => void load()}>Apply filters</Button>
      </Space>
      <Table<AuditEvent>
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={loading}
        pagination={false}
        scroll={{ x: 1550 }}
      />
      <Button disabled={!cursor} onClick={() => cursor && void load(cursor)}>
        Next page
      </Button>
    </div>
  )
}
