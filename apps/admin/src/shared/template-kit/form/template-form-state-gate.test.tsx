import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { getFormModeViewModel } from '../../../routes/form-route-contract'
import { TemplateFormStateGate } from './template-form-state-gate'

void React

describe('TemplateFormStateGate', () => {
  it('shows route param error state when parsedMode is invalid', () => {
    render(
      <MemoryRouter>
        <TemplateFormStateGate
          parsedMode={{ ok: false, errorCode: 'ROUTE_PARAM_INVALID', message: 'bad mode' }}
          modeView={null}
          permissionDenied={false}
          detailLoading={false}
          detailError={null}
          onBackToList={() => undefined}
          onRetryDetail={() => undefined}
        >
          <div>content</div>
        </TemplateFormStateGate>
      </MemoryRouter>
    )

    expect(screen.getByText('路由参数错误')).toBeTruthy()
    expect(screen.getByText('bad mode')).toBeTruthy()
  })

  it('renders loading state for fetchable mode', () => {
    render(
      <MemoryRouter>
        <TemplateFormStateGate
          parsedMode={{ ok: true, mode: 'modify', resourceKey: '1' }}
          modeView={getFormModeViewModel('modify')}
          permissionDenied={false}
          detailLoading={true}
          detailError={null}
          onBackToList={() => undefined}
          onRetryDetail={() => undefined}
        >
          <div>content</div>
        </TemplateFormStateGate>
      </MemoryRouter>
    )

    expect(screen.getByText('正在加载表单详情...')).toBeTruthy()
  })

  it('shows empty state when detail returns not found', () => {
    render(
      <MemoryRouter>
        <TemplateFormStateGate
          parsedMode={{ ok: true, mode: 'readonly', resourceKey: '1' }}
          modeView={getFormModeViewModel('readonly')}
          permissionDenied={false}
          detailLoading={false}
          detailError={{ name: 'Error', message: 'missing', code: 'RESOURCE_NOT_FOUND' }}
          onBackToList={() => undefined}
          onRetryDetail={() => undefined}
        >
          <div>content</div>
        </TemplateFormStateGate>
      </MemoryRouter>
    )

    expect(screen.getByText('请返回列表重新选择记录。')).toBeTruthy()
  })

  it('shows error state when detail loading fails with other error', () => {
    render(
      <MemoryRouter>
        <TemplateFormStateGate
          parsedMode={{ ok: true, mode: 'modify', resourceKey: '1' }}
          modeView={getFormModeViewModel('modify')}
          permissionDenied={false}
          detailLoading={false}
          detailError={{ name: 'Error', message: 'server down', code: 'QUERY_SERVER_ERROR' }}
          onBackToList={() => undefined}
          onRetryDetail={() => undefined}
        >
          <div>content</div>
        </TemplateFormStateGate>
      </MemoryRouter>
    )

    expect(screen.getByText('表单详情加载失败')).toBeTruthy()
    expect(screen.getByText('server down')).toBeTruthy()
  })

  it('renders children in normal state', () => {
    render(
      <MemoryRouter>
        <TemplateFormStateGate
          parsedMode={{ ok: true, mode: 'add' }}
          modeView={getFormModeViewModel('add')}
          permissionDenied={false}
          detailLoading={false}
          detailError={null}
          onBackToList={() => undefined}
          onRetryDetail={() => undefined}
        >
          <div>content</div>
        </TemplateFormStateGate>
      </MemoryRouter>
    )

    expect(screen.getByText('content')).toBeTruthy()
  })

  it('redirects to 403 when permission is denied', () => {
    render(
      <MemoryRouter initialEntries={['/template/list/table/form?mode=add']}>
        <Routes>
          <Route
            path="/template/list/table/form"
            element={
              <TemplateFormStateGate
                parsedMode={{ ok: true, mode: 'add' }}
                modeView={getFormModeViewModel('add')}
                permissionDenied={true}
                detailLoading={false}
                detailError={null}
                onBackToList={() => undefined}
                onRetryDetail={() => undefined}
              >
                <div>content</div>
              </TemplateFormStateGate>
            }
          />
          <Route path="/template/exception/403" element={<div>403 forbidden</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('403 forbidden')).toBeTruthy()
  })
})
