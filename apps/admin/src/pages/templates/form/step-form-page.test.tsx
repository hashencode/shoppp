import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, rs } from '@rstest/core'
import { MemoryRouter } from 'react-router-dom'
import type { StepFormSpec } from '../../../shared/template-kit/form'
import * as actualRecipe from '../../../shared/template-kit/recipes/step-form-recipe' with {
  rstest: 'importActual',
}
import { StepFormPage } from './step-form-page'

void React

const captured = rs.hoisted(() => ({ spec: null as StepFormSpec<object> | null }))

// Keep the real recipe and Ant Form; capture its callback to inspect rejected promises.
rs.mock('../../../shared/template-kit/recipes/step-form-recipe', () => {
  return {
    ...actualRecipe,
    StepFormRecipe: (props: { spec: StepFormSpec<object> }) => {
      captured.spec = props.spec
      return <actualRecipe.StepFormRecipe {...props} />
    },
  }
})

afterEach(() => {
  cleanup()
  rs.restoreAllMocks()
  captured.spec = null
})

const renderPage = () =>
  render(
    <MemoryRouter>
      <StepFormPage />
    </MemoryRouter>
  )

describe('StepFormPage validation', () => {
  it('keeps the current step after invalid input and allows correction', async () => {
    renderPage()
    fireEvent.change(screen.getByPlaceholderText('请输入收款人姓名'), { target: { value: '' } })

    await act(async () => {
      await expect(captured.spec!.onPrimaryAction()).resolves.toBeUndefined()
    })

    expect(await screen.findByText('请输入收款人姓名')).toBeTruthy()
    expect(captured.spec!.currentStep).toBe(0)
    expect(captured.spec!.submitting).toBe(false)

    fireEvent.change(screen.getByPlaceholderText('请输入收款人姓名'), { target: { value: '张三' } })
    await act(async () => {
      await captured.spec!.onPrimaryAction()
    })
    expect(screen.getByPlaceholderText('请输入支付密码')).toBeTruthy()
    expect(captured.spec!.currentStep).toBe(1)

    await act(async () => {
      await captured.spec!.onPrimaryAction()
    })
    expect(await screen.findByText('需要支付密码才能进行支付')).toBeTruthy()
    expect(captured.spec!.currentStep).toBe(1)
    fireEvent.change(screen.getByPlaceholderText('请输入支付密码'), {
      target: { value: 'demo-value' },
    })
    await act(async () => {
      await captured.spec!.onPrimaryAction()
    })
    expect(screen.getByText('预计两小时内到账')).toBeTruthy()
    expect(captured.spec!.currentStep).toBe(2)
  })

  it.each([null, new Error('unexpected validation failure'), { errorFields: null }])(
    'rethrows non-validation failures and clears submitting: %s',
    async (error) => {
      renderPage()
      rs.spyOn(captured.spec!.form, 'validateFields').mockRejectedValueOnce(error)

      await act(async () => {
        await expect(captured.spec!.onPrimaryAction()).rejects.toBe(error)
      })

      expect(captured.spec!.currentStep).toBe(0)
      expect(captured.spec!.submitting).toBe(false)
    }
  )
})
