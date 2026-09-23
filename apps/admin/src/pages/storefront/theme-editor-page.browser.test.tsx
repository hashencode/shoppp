import React, { useState } from 'react'
import { afterEach, expect, describe, it } from '@rstest/core'
import { page } from '@rstest/browser'
import { cleanup, fireEvent, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import type { AdminStorefrontTheme } from '@shoppp/contracts'
import { translateMessage } from '../../shared/contexts/i18n-context'
import { renderInLocale } from '../../test/render-in-locale'
import {
  assertNativeBrowserAndCss,
  assertWithinViewport,
  installBrowserApi,
  renderI18nBrowser,
  switchBrowserLocale,
} from '../../test/i18n-browser-fixture'
import type { StorefrontExperienceDraft } from '../../services/storefront/api'
import { SectionMoveButtons, submitPreviewGrant, ThemeEditorPage } from './theme-editor-page'

void React

let transport: ReturnType<typeof installBrowserApi> | undefined
afterEach(() => {
  cleanup()
  transport?.restore()
  sessionStorage.removeItem('storefront-editor-catalog-release')
  sessionStorage.removeItem('storefront-editor-private-candidate')
})

const theme: AdminStorefrontTheme = {
  id: 'fashion-store',
  themeVersion: '1.0.0',
  configurationSchemaVersion: 1,
  platformContractVersion: '1.0.0',
  platformCompatibility: { min: '1.0.0', maxExclusive: '2.0.0' },
  presets: ['editorial'],
  supportedPageTemplates: ['home'],
  fixtureBindings: [],
  componentRegistry: {
    blocks: [
      {
        type: 'hero.slide',
        capabilities: [],
        settings: [
          { id: 'title', kind: 'text', default: 'Browser slide', maxLength: 100, required: true },
        ],
      },
    ],
    sections: [
      {
        type: 'hero',
        allowedBlockTypes: ['hero.slide'],
        blockRules: [{ blockType: 'hero.slide', min: 0, max: 3 }],
        capabilities: [],
        settings: [
          {
            id: 'heading',
            kind: 'text',
            default: 'Saved headline',
            maxLength: 100,
            required: true,
          },
          { id: 'product', kind: 'product-reference', required: true },
          {
            id: 'image',
            kind: 'asset',
            required: false,
            default: {
              alt: 'Hero',
              height: 600,
              kind: 'theme',
              path: 'assets/hero.webp',
              width: 800,
            },
          },
          {
            id: 'cta',
            kind: 'link',
            required: false,
            allowedTargets: ['external'],
            default: {
              label: 'Original link',
              target: { kind: 'external', url: 'https://example.test/path?a=1' },
              targetBehavior: 'new-window',
            },
          },
        ],
      },
    ],
  },
  presetDefinitions: [
    {
      id: 'editorial',
      label: 'Editorial',
      templates: [
        {
          id: 'home',
          pageType: 'home',
          requiredCapabilities: [],
          sections: [
            {
              id: 'hero',
              type: 'hero',
              visible: true,
              blocks: [
                {
                  actions: [],
                  capabilities: [],
                  id: 'browser-slide',
                  settings: { title: 'Browser slide' },
                  type: 'hero.slide',
                  visible: true,
                },
              ],
              capabilities: [],
              settings: { heading: 'Saved headline' },
            },
          ],
        },
      ],
    },
  ],
}
const draft: StorefrontExperienceDraft = {
  id: 'draft-browser',
  experienceId: 'storefront-browser',
  themeId: theme.id,
  themeVersion: theme.themeVersion,
  configurationSchemaVersion: 1,
  createdAt: '2026-09-03T00:00:00.000Z',
  updatedAt: '2026-09-03T00:00:00.000Z',
  createdBy: 'browser-operator',
  updatedBy: 'browser-operator',
  presetId: 'editorial',
  overrides: [],
  bindings: [
    {
      id: 'catalog-hero-product',
      kind: 'catalog',
      instanceId: 'hero',
      settingId: 'product',
      reference: { kind: 'product', id: 'removed-product' },
    },
  ],
  version: 1,
  validation: null,
  validations: [],
}

const renderEditor = (failure: 'conflict' | 'persistent', staleCandidate = false) => {
  let failMedia = true
  transport = installBrowserApi((request) => {
    if (
      request.method === 'put' &&
      request.url === '/admin/storefront-experiences/drafts/draft-browser'
    ) {
      return {
        status: failure === 'conflict' ? 409 : 422,
        data: {
          error: {
            code:
              failure === 'conflict'
                ? 'storefront_experience_draft_conflict'
                : 'storefront_experience_validation_stale',
            message: 'PRIVATE SERVER SENTENCE',
          },
        },
      }
    }
    if (
      request.method === 'post' &&
      request.url === '/admin/storefront-experiences/drafts/draft-browser/block-commands'
    ) {
      const body = JSON.parse(request.data as string) as {
        command: { kind: string; blockIds?: string[] }
      }
      const added = {
        block: {
          actions: [],
          capabilities: [],
          id:
            body.command.kind === 'duplicate' ? 'browser-slide-server-copy' : 'browser-slide-added',
          settings: {
            title:
              body.command.kind === 'duplicate' ? 'Browser slide copy' : 'Added browser slide',
          },
          type: 'hero.slide',
          visible: true,
        },
        kind: 'add-block' as const,
        sectionId: 'hero',
      }
      const operations =
        body.command.kind === 'remove'
          ? [{ instanceId: 'browser-slide', kind: 'remove-block' as const }]
          : body.command.kind === 'reorder'
            ? [
                added,
                {
                  instanceIds: body.command.blockIds ?? [],
                  kind: 'reorder-blocks' as const,
                  sectionId: 'hero',
                },
              ]
            : [added]
      return {
        data: {
          data: {
            ...draft,
            version: 2,
            overrides: [
              {
                operations,
                presetId: 'editorial',
                schemaVersion: 1,
                templateId: 'home',
              },
            ],
          },
        },
      }
    }
    if (request.method !== 'get') throw new Error(`Unexpected write ${request.url}`)
    if (request.url?.endsWith('/operator-run') || request.url?.endsWith('/preview-context'))
      return { data: { data: null } }
    if (request.url === '/admin/storefront-experiences/drafts/draft-browser')
      return { data: { data: draft } }
    if (request.url === '/admin/storefront-experiences/themes') return { data: { data: [theme] } }
    if (request.url === '/admin/storefront-experiences/catalog-releases')
      return {
        data: {
          data: [
            {
              id: 'release-browser',
              approvedAt: draft.createdAt,
              deployedAt: draft.createdAt,
              environment: 'staging',
              status: 'deployed',
              products: [
                { id: 'product-atlas', kind: 'product', name: 'Atlas / Carry-on', slug: 'atlas' },
              ],
              collections: [],
            },
          ],
        },
      }
    if (
      staleCandidate &&
      request.url === '/admin/catalog/releases/preview-candidates/release-stale-candidate'
    ) {
      return {
        status: 409,
        data: { error: { code: 'catalog_candidate_unavailable', message: 'Expired candidate' } },
      }
    }
    if (request.url?.endsWith('/resources'))
      return {
        data: {
          data: [
            {
              id: 'product-atlas',
              kind: 'product',
              name: 'Atlas / Carry-on',
              path: '/products/atlas',
            },
          ],
          page: 1,
          pageSize: 12,
          total: 1,
        },
      }
    if (request.url === '/admin/storefront-experiences/media') {
      if (failMedia) {
        failMedia = false
        return { status: 503, data: {} }
      }
      return { data: { data: [], meta: { page: 1, pageSize: 12, total: 0 } } }
    }
    throw new Error(`Unexpected request ${request.url}`)
  })
  const router = createMemoryRouter(
    [{ path: '/storefront/themes/:draftId', element: <ThemeEditorPage /> }],
    { initialEntries: ['/storefront/themes/draft-browser'] }
  )
  return renderI18nBrowser(<RouterProvider router={router} />, [
    'themes.read',
    'themes.write',
    'themes.preview',
    'catalog.read',
  ])
}

describe('ThemeEditorPage browser behavior', () => {
  it(
    'adds, reorders, and duplicates Blocks through the real editor controls',
    { timeout: 20_000 },
    async () => {
      renderEditor('persistent')
      const collapse = await waitFor(() => {
        const target = document.querySelector<HTMLElement>(
          '[data-testid="blocks-hero"] .ant-collapse-header'
        )
        expect(target).toBeTruthy()
        return target!
      })
      fireEvent.click(collapse)
      const reason = await waitFor(() => {
        const target = document.querySelector<HTMLTextAreaElement>('[data-testid="change-reason"]')
        expect(target).toBeTruthy()
        return target!
      })
      fireEvent.change(reason, { target: { value: 'Add a browser Block' } })
      const add = await waitFor(() => {
        const target = document.querySelector<HTMLButtonElement>('[data-block-focus="add:hero"]')
        expect(target).toBeTruthy()
        return target!
      })
      fireEvent.click(add)
      await waitFor(() =>
        expect(document.querySelector('[data-block-focus="browser-slide-added"]')).toBeTruthy()
      )

      fireEvent.change(
        document.querySelector<HTMLTextAreaElement>('[data-testid="change-reason"]')!,
        { target: { value: 'Reorder browser Blocks' } }
      )
      const moveBefore = await waitFor(() => {
        const target = document
          .querySelector('[data-block-focus="browser-slide-added"] .anticon-arrow-up')
          ?.closest<HTMLButtonElement>('button')
        expect(target).toBeTruthy()
        return target!
      })
      fireEvent.click(moveBefore)
      await waitFor(() => {
        const writes = transport!.requests.filter(({ method }) => method === 'post')
        const command = JSON.parse(writes.at(-1)!.data as string).command
        expect(command).toMatchObject({
          blockIds: ['browser-slide-added', 'browser-slide'],
          kind: 'reorder',
          sectionId: 'hero',
        })
      })

      fireEvent.change(
        document.querySelector<HTMLTextAreaElement>('[data-testid="change-reason"]')!,
        { target: { value: 'Duplicate browser Block' } }
      )
      const duplicateLabel =
        document.documentElement.lang === 'zh-CN'
          ? translateMessage('zh-CN', 'Duplicate')
          : 'Duplicate'
      const duplicate = await waitFor(() => {
        const target = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
          (button) => button.textContent?.trim() === duplicateLabel
        )
        expect(target).toBeTruthy()
        return target!
      })
      fireEvent.click(duplicate)
      await waitFor(() => {
        const writes = transport!.requests.filter(({ method }) => method === 'post')
        const command = JSON.parse(writes.at(-1)!.data as string).command
        expect(command).toMatchObject({
          blockId: 'browser-slide-added',
          kind: 'duplicate',
          templateId: 'home',
        })
        expect(
          document.querySelector('[data-block-focus="browser-slide-server-copy"]')
        ).toBeTruthy()
      })
    }
  )

  it(
    'focuses the Section Block controls after removing the only Block',
    { timeout: 20_000 },
    async () => {
      renderEditor('persistent')
      const collapse = await waitFor(() => {
        const target = document.querySelector<HTMLElement>(
          '[data-testid="blocks-hero"] .ant-collapse-header'
        )
        expect(target).toBeTruthy()
        return target!
      })
      fireEvent.click(collapse)
      const reason = await waitFor(() => {
        const target = document.querySelector<HTMLTextAreaElement>('[data-testid="change-reason"]')
        expect(target).toBeTruthy()
        return target!
      })
      fireEvent.change(reason, { target: { value: 'Remove browser slide' } })
      const remove = await waitFor(() => {
        const target = document.querySelector<HTMLButtonElement>(
          '[data-block-focus="browser-slide"] .ant-btn-dangerous'
        )
        expect(target).toBeTruthy()
        return target!
      })
      fireEvent.click(remove)
      const confirm = await waitFor(() => {
        const target = document.querySelector<HTMLButtonElement>(
          '.ant-popconfirm-buttons .ant-btn-primary'
        )
        expect(target).toBeTruthy()
        return target!
      })
      fireEvent.click(confirm)
      await waitFor(() =>
        expect(document.activeElement?.getAttribute('data-block-focus')).toBe('section:hero')
      )
    }
  )

  it(
    'preserves deployed releases and clears a stale private-candidate handoff',
    { timeout: 20_000 },
    async () => {
      sessionStorage.setItem('storefront-editor-catalog-release', 'release-stale-candidate')
      sessionStorage.setItem('storefront-editor-private-candidate', 'release-stale-candidate')
      renderEditor('persistent', true)

      await waitFor(() => {
        expect(
          transport?.requests.some(
            ({ url }) =>
              url === '/admin/catalog/releases/preview-candidates/release-stale-candidate'
          )
        ).toBe(true)
        expect(document.body.textContent).toContain(
          translateMessage('zh-CN', 'Private Catalog candidate is no longer available')
        )
        expect(document.body.textContent).toContain('release-browser')
        expect(sessionStorage.getItem('storefront-editor-catalog-release')).toBeNull()
        expect(sessionStorage.getItem('storefront-editor-private-candidate')).toBeNull()
      })
    }
  )

  it(
    'keeps the final Home content Section visible and focuses its local error',
    { timeout: 20_000 },
    async () => {
      renderEditor('persistent')
      const visibilityElement = await waitFor(() => {
        const target = [...document.querySelectorAll<HTMLElement>('[role="switch"]')].find(
          (element) => !element.getAttribute('aria-label')?.includes('browser-slide')
        )
        expect(target).toBeTruthy()
        return target!
      })
      const beforeAttempt = transport!.requests.filter(({ method }) => method !== 'get').length

      fireEvent.click(visibilityElement)

      const messageText =
        document.documentElement.lang === 'zh-CN'
          ? translateMessage('zh-CN', 'At least one Home content Section must remain visible.')
          : 'At least one Home content Section must remain visible.'
      const message = page.getByText(messageText)
      await expect.element(message).toBeVisible()
      expect(visibilityElement.getAttribute('aria-checked')).toBe('true')
      await waitFor(() =>
        expect(document.activeElement?.textContent).toContain(messageText)
      )
      expect(transport!.requests.filter(({ method }) => method !== 'get')).toHaveLength(
        beforeAttempt
      )
    }
  )

  it.each(['conflict', 'persistent'] as const)(
    'preserves dirty fields and bindings through a %s language switch, then executes the existing recovery',
    { timeout: 20_000 },
    async (failure) => {
      renderEditor(failure)
      await expect
        .element(page.getByRole('textbox', { name: 'hero heading', exact: true }))
        .toBeVisible()
      assertNativeBrowserAndCss()
      expect(document.documentElement.lang).not.toBe(navigator.language)
      // Exercise the Chinese resource/media/link controls even with a Chinese native browser.
      if (document.documentElement.lang !== 'zh-CN') await switchBrowserLocale()
      await expect.element(page.getByText('当前版本中缺少所选引用，请选择替代项。')).toBeVisible()
      await page
        .getByRole('textbox', { name: 'hero heading', exact: true })
        .fill('Unsaved / 中文 headline')
      await page
        .getByRole('textbox', { name: '变更原因', exact: true })
        .fill('Browser language recovery')
      await page.getByRole('combobox', { name: 'hero product', exact: true }).click()
      await page.getByText('Atlas / Carry-on · /products/atlas', { exact: true }).click()
      const linkInput = page.getByRole('textbox', { name: 'hero cta 文字', exact: true })
      await linkInput.fill('Raw / Link 名称')
      await page.getByRole('button', { name: '重试加载媒体' }).click()
      await expect.element(page.getByText('没有符合搜索条件的已批准商品目录媒体。')).toBeVisible()
      await page.getByRole('button', { name: '保存', exact: true }).click()
      const recovery = failure === 'conflict' ? '保留本地修改' : '重新加载已保存草稿'
      await expect.element(page.getByRole('button', { name: recovery, exact: true })).toBeVisible()
      const errorMessage =
        failure === 'conflict'
          ? 'Your local edits are preserved. Reload and discard them, or save them as a separate successor draft for review.'
          : 'Validate the current draft version before creating a snapshot.'
      expect(document.body.textContent).toContain(translateMessage('zh-CN', errorMessage))
      expect(document.body.textContent).not.toContain('PRIVATE SERVER SENTENCE')
      const beforeSwitch = transport!.requests.length
      const requestBody = JSON.parse(
        transport!.requests.find(({ method }) => method === 'put')!.data as string
      )
      expect(requestBody.bindings).toEqual([
        expect.objectContaining({
          instanceId: 'hero',
          settingId: 'product',
          reference: { id: 'product-atlas', kind: 'product' },
        }),
      ])
      for (const fieldset of document.querySelectorAll('fieldset')) assertWithinViewport(fieldset)
      assertWithinViewport(
        [...document.querySelectorAll('button')].find(
          (button) => button.textContent?.trim() === recovery
        )!
      )
      if (failure === 'conflict') {
        for (const label of ['重新加载并放弃本地修改', '将本地修改保存为后继草稿']) {
          assertWithinViewport(
            [...document.querySelectorAll('button')].find(
              (button) => button.textContent?.trim() === label
            )!
          )
        }
      }
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
      await switchBrowserLocale()
      await expect
        .element(
          page.getByRole('button', {
            name: failure === 'conflict' ? 'Keep local edits' : 'Reload saved draft',
            exact: true,
          })
        )
        .toBeVisible()
      expect(
        document.querySelector<HTMLTextAreaElement>('[aria-label="hero heading"]')?.value
      ).toBe('Unsaved / 中文 headline')
      expect(
        document.querySelector<HTMLInputElement>('input[aria-label="hero cta label"]')?.value
      ).toBe('Raw / Link 名称')
      expect(
        document.querySelector<HTMLTextAreaElement>('[aria-label="Change reason"]')?.value
      ).toBe('Browser language recovery')
      expect(
        document.querySelector('input[aria-label="hero product"]')?.closest('.ant-select')
          ?.textContent
      ).toContain('Atlas / Carry-on')
      expect(
        document.querySelector('[aria-label="Catalog Release"]')?.closest('.ant-select')
          ?.textContent
      ).toContain('release-browser')
      expect(document.body.textContent).toContain(errorMessage)
      await waitFor(() => expect(transport!.requests).toHaveLength(beforeSwitch))
      await switchBrowserLocale()
      expect(transport!.requests).toHaveLength(beforeSwitch)
      expect(document.body.textContent).toContain(translateMessage('zh-CN', errorMessage))
      if (failure === 'conflict') {
        await page.getByRole('button', { name: '保留本地修改', exact: true }).click()
        expect(
          document.querySelector<HTMLTextAreaElement>('[aria-label="hero heading"]')?.value
        ).toBe('Unsaved / 中文 headline')
        expect(transport!.requests).toHaveLength(beforeSwitch)
      } else {
        const originalConfirm = window.confirm
        let confirmation = ''
        window.confirm = (message) => {
          confirmation = message ?? ''
          return true
        }
        try {
          await page.getByRole('button', { name: '重新加载已保存草稿', exact: true }).click()
        } finally {
          window.confirm = originalConfirm
        }
        expect(confirmation).toBe(
          translateMessage(
            'zh-CN',
            'Discard local theme edits and reload the last saved draft version?'
          )
        )
        await waitFor(() =>
          expect(
            document.querySelector<HTMLTextAreaElement>('[aria-label="hero heading"]')?.value
          ).toBe('Saved headline')
        )
        expect(transport!.requests.filter(({ method }) => method !== 'get')).toHaveLength(1)
      }
    }
  )

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
              t={(message, values) => translateMessage('en-US', message, values)}
            />
          ))}
        </div>
      )
    }

    renderInLocale(<OrderHarness />, 'en-US')
    await page.getByRole('button', { name: 'Move story before' }).click()
    await expect.element(page.getByText('story,hero')).toBeVisible()
    await expect.element(page.getByRole('button', { name: 'Move story before' })).toBeDisabled()
  })

  it('submits the one-time grant in a new-tab POST without putting it in the URL', async () => {
    let submitted:
      | {
          action: string
          grant: string | null
          method: string
          referrerPolicy: string
          target: string
        }
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
    renderInLocale(
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
      </button>,
      'en-US'
    )

    await page.getByRole('button', { name: 'Open authenticated preview' }).click()
    expect(submitted).toEqual({
      action: 'https://preview.example.test/__preview/session',
      grant: 'grant_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      method: 'post',
      referrerPolicy: '',
      target: '_blank',
    })
    expect(submitted?.action).not.toContain('grant_')
    HTMLFormElement.prototype.submit = originalSubmit
  })
})
