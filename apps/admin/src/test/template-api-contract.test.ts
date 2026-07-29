import { describe, expect, it, beforeEach, beforeAll, afterEach, afterAll } from '@rstest/core'
import { setupServer } from 'msw/node'
import { templateHandlers } from '../infrastructure/msw/handlers/template-handlers'
import { templateFormData, templateRuleData } from '../infrastructure/msw/handlers/template-data'

const server = setupServer(...templateHandlers)

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})

const seedRules = templateRuleData.map((item) => ({ ...item }))
const seedForms = templateFormData.map((item) => ({ ...item }))

const resetTemplateSeeds = () => {
  templateRuleData.splice(0, templateRuleData.length, ...seedRules.map((item) => ({ ...item })))
  templateFormData.splice(0, templateFormData.length, ...seedForms.map((item) => ({ ...item })))
}

const api = (path: string) => `http://localhost${path}`

describe('template handlers contract', () => {
  beforeEach(() => {
    resetTemplateSeeds()
  })

  it('returns rule list with stable contract fields', async () => {
    const response = await fetch(api('/api/template/rules'))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: unknown[] }
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBeGreaterThan(0)
    const first = body.data[0] as Record<string, unknown>
    expect(typeof first.key).toBe('string')
    expect(typeof first.name).toBe('string')
    expect(typeof first.desc).toBe('string')
    expect(typeof first.callNo).toBe('number')
    expect(typeof first.updatedAt).toBe('string')
    expect([0, 1, 2, 3]).toContain(first.status)
  })

  it('returns partial contract when scenario=partial', async () => {
    const response = await fetch(api('/api/template/rules?__scenario=partial'))
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: unknown[]
      partial?: boolean
      partialMessage?: string
    }
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.partial).toBe(true)
    expect(typeof body.partialMessage).toBe('string')
  })

  it('returns empty list contract when scenario=empty', async () => {
    const response = await fetch(api('/api/template/rules?__scenario=empty'))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: unknown[] }
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data).toEqual([])
  })

  it('returns RESOURCE_NOT_FOUND contract for missing form detail', async () => {
    const response = await fetch(api('/api/template/forms/not-exists'))
    expect(response.status).toBe(404)
    const body = (await response.json()) as { errorCode?: string; message?: string }
    expect(body.errorCode).toBe('RESOURCE_NOT_FOUND')
    expect(typeof body.message).toBe('string')
  })

  it('creates and updates form with stable contract fields', async () => {
    const payload = {
      title: 'Contract Test Form',
      dateRangeStart: new Date().toISOString(),
      dateRangeEnd: new Date().toISOString(),
      goal: 'goal',
      standard: 'standard',
      client: 'client',
      invites: 'invites',
      weight: 50,
      publicType: '2',
      publicUsers: ['同事甲'],
    }

    const createResponse = await fetch(api('/api/template/forms'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    expect(createResponse.status).toBe(200)
    const created = (await createResponse.json()) as { data: Record<string, unknown> }
    expect(typeof created.data.resourceKey).toBe('string')
    expect(created.data.title).toBe(payload.title)
    expect(created.data.publicType).toBe(payload.publicType)

    const updateResponse = await fetch(api(`/api/template/forms/${String(created.data.resourceKey)}`), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, title: 'Updated Form' }),
    })
    expect(updateResponse.status).toBe(200)
    const updated = (await updateResponse.json()) as { data: Record<string, unknown> }
    expect(updated.data.title).toBe('Updated Form')
    expect(updated.data.resourceKey).toBe(created.data.resourceKey)
  })
})
