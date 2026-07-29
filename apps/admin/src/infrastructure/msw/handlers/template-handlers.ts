import { delay, http, HttpResponse } from 'msw'
import { templateFormData, templateRuleData } from './template-data'
import type { FormEntity, FormPayload } from '../../../pages/templates/form/api'

const getScenario = (request: Request): 'success' | 'empty' | 'error' | 'timeout' | 'partial' => {
  const url = new URL(request.url)
  const scenario =
    request.headers.get('x-template-scenario') ?? url.searchParams.get('__scenario') ?? 'success'

  if (scenario === 'empty' || scenario === 'error' || scenario === 'timeout' || scenario === 'partial') {
    return scenario
  }

  return 'success'
}

const withScenario = async (request: Request) => {
  const scenario = getScenario(request)

  if (scenario === 'timeout') {
    await delay(6000)
  }

  if (scenario === 'error') {
    return HttpResponse.json(
      {
        errorCode: 'QUERY_SERVER_ERROR',
        message: '模板接口模拟异常，请稍后重试。',
      },
      {
        status: 500,
      }
    )
  }

  return null
}

const detailMap = ['timeout', 'invalid-param', 'permission-denied', 'upstream-unavailable'] as const
const resolveStatusDetail = (key: string) => detailMap[Number(key) % detailMap.length]

export const templateHandlers = [
  http.get('*/api/template/rules', async ({ request }) => {
    const scenarioResponse = await withScenario(request)

    if (scenarioResponse) {
      return scenarioResponse
    }

    const scenario = getScenario(request)
    const url = new URL(request.url)
    const name = url.searchParams.get('name')?.trim().toLowerCase()
    const status = url.searchParams.get('status')
    const statusDetail = url.searchParams.get('statusDetail')
    const updatedAt = url.searchParams.get('updatedAt')

    let data = templateRuleData.filter((item) => {
      if (name && !item.name.toLowerCase().includes(name)) {
        return false
      }

      if (status !== null && status !== '' && item.status !== Number(status)) {
        return false
      }

      if (statusDetail && resolveStatusDetail(item.key) !== statusDetail) {
        return false
      }

      if (updatedAt && !item.updatedAt.startsWith(updatedAt)) {
        return false
      }

      return true
    })

    if (scenario === 'empty') {
      data = []
    }

    if (scenario === 'partial') {
      return HttpResponse.json({
        data: data.slice(0, Math.max(1, Math.floor(data.length / 2))),
        partial: true,
        partialMessage: '当前仅返回部分结果，请检查网络后重试。',
      })
    }

    return HttpResponse.json({ data })
  }),

  http.get('*/api/template/forms/:resourceKey', async ({ request, params }) => {
    const scenarioResponse = await withScenario(request)

    if (scenarioResponse) {
      return scenarioResponse
    }

    const scenario = getScenario(request)

    if (scenario === 'empty') {
      return HttpResponse.json(
        {
          errorCode: 'RESOURCE_NOT_FOUND',
          message: '该记录不存在或已删除。',
        },
        { status: 404 }
      )
    }

    const resourceKey = String(params.resourceKey)
    const found = templateFormData.find((item) => item.resourceKey === resourceKey)

    if (!found) {
      return HttpResponse.json(
        {
          errorCode: 'RESOURCE_NOT_FOUND',
          message: '该记录不存在或已删除。',
        },
        {
          status: 404,
        }
      )
    }

    return HttpResponse.json({ data: found })
  }),

  http.post('*/api/template/forms', async ({ request }) => {
    const scenarioResponse = await withScenario(request)

    if (scenarioResponse) {
      return scenarioResponse
    }

    const payload = (await request.json()) as FormPayload
    const resourceKey = String(templateFormData.length + 1)
    const entity: FormEntity = {
      ...payload,
      resourceKey,
    }

    templateFormData.push(entity)

    return HttpResponse.json({ data: entity })
  }),

  http.put('*/api/template/forms/:resourceKey', async ({ request, params }) => {
    const scenarioResponse = await withScenario(request)

    if (scenarioResponse) {
      return scenarioResponse
    }

    const payload = (await request.json()) as FormPayload
    const resourceKey = String(params.resourceKey)
    const targetIndex = templateFormData.findIndex((item) => item.resourceKey === resourceKey)

    if (targetIndex < 0) {
      return HttpResponse.json(
        {
          errorCode: 'RESOURCE_NOT_FOUND',
          message: '该记录不存在或已删除。',
        },
        {
          status: 404,
        }
      )
    }

    const next = {
      ...payload,
      resourceKey,
    }

    templateFormData[targetIndex] = next

    return HttpResponse.json({ data: next })
  }),
]
