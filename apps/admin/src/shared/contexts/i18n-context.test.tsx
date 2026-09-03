import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from '@rstest/core'
import dayjs from 'dayjs'
import { ADMIN_PERMISSION_CATALOG } from '@shoppp/contracts'
import { zhCNMessages } from '../i18n/translations'
import {
  I18nProvider,
  LANGUAGE_STORAGE_KEY,
  translateMessage,
  useCurrentTranslate,
  useI18n,
} from './i18n-context'

void React

const Probe = () => {
  const { locale, setLocale, t } = useI18n()
  const [persisted, setPersisted] = React.useState<boolean | null>(null)

  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span>{t('Welcome')}</span>
      <span data-testid="persisted">{persisted === null ? '' : String(persisted)}</span>
      <button type="button" onClick={() => setPersisted(setLocale('en-US'))}>
        English
      </button>
    </div>
  )
}

describe('I18nProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    dayjs.locale('en')
  })

  it('uses the system language when no preference has been stored', () => {
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: ['zh-CN', 'en-US'],
    })

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    )

    expect(screen.getByTestId('locale').textContent).toBe('zh-CN')
    expect(screen.getByText('欢迎')).toBeTruthy()
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull()
    expect(dayjs('2024-01-01').format('MMMM')).toBe('一月')
  })

  it('prefers a stored language and persists a new selection', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'zh-CN')

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    )

    fireEvent.click(screen.getByText('English'))

    expect(screen.getByTestId('locale').textContent).toBe('en-US')
    expect(screen.getByText('Welcome')).toBeTruthy()
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en-US')
    expect(screen.getByTestId('persisted').textContent).toBe('true')
    expect(document.documentElement.lang).toBe('en-US')
    expect(dayjs('2024-01-01').format('MMMM')).toBe('January')
  })

  it('uses the primary system language when multiple languages are available', () => {
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: ['en-US', 'zh-CN'],
    })

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    )

    expect(screen.getByTestId('locale').textContent).toBe('en-US')
    expect(screen.getByText('Welcome')).toBeTruthy()
  })

  it('falls back to the system language when stored preferences cannot be read', () => {
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: ['zh-CN'],
    })
    const originalGetItem = Storage.prototype.getItem
    Storage.prototype.getItem = () => {
      throw new Error('storage blocked')
    }

    try {
      render(
        <I18nProvider>
          <Probe />
        </I18nProvider>
      )
      expect(screen.getByTestId('locale').textContent).toBe('zh-CN')
    } finally {
      Storage.prototype.getItem = originalGetItem
    }
  })

  it('keeps a new selection in memory when it cannot be persisted', async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'zh-CN')
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('storage blocked')
    }

    try {
      render(
        <I18nProvider>
          <Probe />
        </I18nProvider>
      )
      fireEvent.click(screen.getByText('English'))

      await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('en-US'))
      expect(screen.getByText('Welcome')).toBeTruthy()
      expect(screen.getByTestId('persisted').textContent).toBe('false')
    } finally {
      Storage.prototype.setItem = originalSetItem
    }
  })

  it('translates the current authentication, IAM, and theme workflows without key fallback', () => {
    const visibleWorkflowMessages = [
      'Sign in to Shoppp Admin',
      'Change password',
      'Activate admin account',
      'Reset password',
      'Users and invitations',
      'Role permissions',
      'Confirm permission reduction',
      'Storefront themes',
      'Approved packages',
      'Create experience draft',
      'Validate saved version',
      'Open authenticated preview',
      'Approve immutable experience snapshot',
    ]

    for (const message of visibleWorkflowMessages) {
      expect(translateMessage('zh-CN', message)).not.toBe(message)
      expect(translateMessage('en-US', message)).toBe(message)
    }
    expect(translateMessage('zh-CN', 'Unknown future message')).toBe('Unknown future message')
  })

  it('keeps the current translator stable while an existing consumer reads the new language', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en-US')
    let retainedTranslate: ReturnType<typeof useCurrentTranslate> | undefined
    let effectRuns = 0
    const CurrentTranslatorProbe = () => {
      const translateNow = useCurrentTranslate()
      const { setLocale } = useI18n()
      React.useEffect(() => {
        effectRuns += 1
        retainedTranslate = translateNow
      }, [translateNow])
      return <button onClick={() => setLocale('zh-CN')}>Chinese</button>
    }
    render(
      <I18nProvider>
        <CurrentTranslatorProbe />
      </I18nProvider>
    )
    const initialTranslate = retainedTranslate
    expect(initialTranslate?.('Welcome')).toBe('Welcome')
    expect(effectRuns).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Chinese' }))
    expect(retainedTranslate).toBe(initialTranslate)
    expect(effectRuns).toBe(1)
    expect(initialTranslate?.('Welcome')).toBe('欢迎')
    expect(initialTranslate?.('Successor draft {id} created for review.', { id: 'Refund' })).toBe(
      '已创建后继草稿 Refund，等待审核。'
    )
  })

  it('covers every permission label, explanation and category without translating permission IDs', () => {
    for (const permission of ADMIN_PERMISSION_CATALOG) {
      for (const key of [permission.label, permission.description, permission.category]) {
        expect(Object.hasOwn(zhCNMessages, key)).toBe(true)
        expect(translateMessage('zh-CN', key)).toBe(zhCNMessages[key])
        expect(translateMessage('en-US', key)).toBe(key)
      }
      expect(translateMessage('zh-CN', permission.key)).toBe(permission.key)
    }
    expect(
      translateMessage('zh-CN', 'Successor draft {id} created for review.', { id: 'draft_ABC' })
    ).toBe('已创建后继草稿 draft_ABC，等待审核。')
  })
})
