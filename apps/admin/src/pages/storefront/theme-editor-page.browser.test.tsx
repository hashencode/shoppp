import React, { useState } from 'react'
import { expect, describe, it } from '@rstest/core'
import { page } from '@rstest/browser'
import { render } from '@testing-library/react'
import { SectionMoveButtons, submitPreviewGrant } from './theme-editor-page'

void React

describe('ThemeEditorPage browser behavior', () => {
  it('reorders through touch and keyboard accessible buttons in a real browser', async () => {
    const OrderHarness = () => {
      const [items, setItems] = useState(['hero', 'story'])
      const move = (instanceId: string, direction: -1 | 1) => {
        setItems((current) => {
          const next = [...current]
          const index = next.indexOf(instanceId)
          const target = index + direction
          if (target < 0 || target >= next.length) return current
          next.splice(index, 1)
          next.splice(target, 0, instanceId)
          return next
        })
      }
      return (
        <div>
          <output aria-label="Section order">{items.join(',')}</output>
          {items.map((instanceId, index) => (
            <SectionMoveButtons
              key={instanceId}
              count={items.length}
              index={index}
              instanceId={instanceId}
              onMove={(direction) => move(instanceId, direction)}
              t={(message) => message}
            />
          ))}
        </div>
      )
    }

    render(<OrderHarness />)
    await page.getByRole('button', { name: 'Move story before' }).click()
    await expect.element(page.getByText('story,hero')).toBeVisible()
    await expect.element(page.getByRole('button', { name: 'Move story before' })).toBeDisabled()
  })

  it('submits the one-time grant in a new-tab POST without putting it in the URL', async () => {
    let submitted:
      | { action: string; grant: string | null; method: string; referrerPolicy: string; target: string }
      | undefined
    const originalSubmit = HTMLFormElement.prototype.submit
    HTMLFormElement.prototype.submit = function (this: HTMLFormElement) {
      submitted = {
        action: this.action,
        grant: new FormData(this).get('grant')?.toString() ?? null,
        method: this.method,
        referrerPolicy: this.getAttribute('referrerpolicy') ?? '',
        target: this.target,
      }
    }
    render(
      <button
        type="button"
        onClick={() =>
          submitPreviewGrant({
            grant: 'grant_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
            redeemUrl: 'https://preview.example.test/__preview/session',
          })
        }
      >
        Open authenticated preview
      </button>
    )

    await page.getByRole('button', { name: 'Open authenticated preview' }).click()
    expect(submitted).toEqual({
      action: 'https://preview.example.test/__preview/session',
      grant: 'grant_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      method: 'post',
      referrerPolicy: 'no-referrer',
      target: '_blank',
    })
    expect(submitted?.action).not.toContain('grant_')
    HTMLFormElement.prototype.submit = originalSubmit
  })
})
